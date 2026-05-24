import {
  GoogleGenerativeAI,
  SchemaType,
  FunctionDeclaration,
  Content,
  Part,
} from "@google/generative-ai";
import { logSalah } from "./tools/logSalah";
import { getSalahStats } from "./tools/getSalahStats";
import { navigateQuran, NavigateQuranResult } from "./tools/navigateQuran";
import { loadHistory, saveTurn } from "./memory";

// Define tools the agent can call
const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "log_salah",
    description:
      "Logs a completed prayer to the user's Salah history. Call this whenever the user mentions they prayed any of the five daily prayers (fajr, dhuhr, asr, maghrib, isha) — even casually like 'just finished Maghrib' or 'prayed Fajr alhamdulillah'.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        prayer: {
          type: SchemaType.STRING,
          description: "Lowercase prayer name: fajr, dhuhr, asr, maghrib, or isha",
        },
        on_time: {
          type: SchemaType.BOOLEAN,
          description: "Whether the prayer was on time. Default true if user doesn't say.",
        },
      },
      required: ["prayer"],
    },
  },
  {
    name: "get_salah_stats",
    description:
      "Fetches the user's prayer activity for the last 7 days. Returns counts, consistency percentage, and current streak. CALL THIS FIRST whenever the user asks about their progress, consistency, streak, or asks for advice — so your response is grounded in real data.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
      required: [],
    },
  },
  {
    name: "navigate_quran",
    description:
      "Returns a navigation command for the Sukoon app to jump to a specific Quran verse. Use when the user wants to read, open, or jump to a specific surah or ayah. You can pass surah as a name (e.g., 'Al-Kahf') or number (1-114).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        surah: {
          type: SchemaType.STRING,
          description: "Surah name (e.g., 'Al-Kahf', 'Yaseen') or number (1-114) as a string",
        },
        ayah: {
          type: SchemaType.NUMBER,
          description: "Ayah number within the surah. Default 1 if not specified.",
        },
      },
      required: ["surah"],
    },
  },
];

const SYSTEM_INSTRUCTION = `You are Sukoon, a warm and gentle Islamic companion in a mobile app. You help Muslims track their Salah, navigate the Quran, and offer soft naseeha (advice).

Behavior rules:
1. When the user mentions praying any Salah — even casually — call log_salah immediately with the prayer name in lowercase.
2. When the user wants to read or jump to a Quran verse, call navigate_quran.
3. When the user asks about their progress, consistency, streak, or asks for advice/encouragement, call get_salah_stats FIRST, then respond based on actual data.
4. Reply style: warm, short (2-4 sentences), never preachy, never guilt-trippy. Use Islamic phrases (Alhamdulillah, InshaAllah, MashaAllah, Barakallahu feek) naturally and sparingly — not in every sentence.
5. If the user is struggling emotionally, lead with empathy before any practical advice.
6. If the user logs a prayer that was already logged today, just gently acknowledge it without re-logging.
7. Never invent prayer data — always use the tool results.`;

export interface AgentResponse {
  reply: string;
  commands: NavigateQuranResult[];
  session_id: string;
}

/**
 * Main agent entry point. Takes a user message + session, returns reply + any UI commands.
 */
export async function runAgent(
  userId: string,
  sessionId: string,
  userMessage: string,
  geminiApiKey: string
): Promise<AgentResponse> {
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
  });

  // Load conversation history from Firestore
  const history = await loadHistory(userId, sessionId);
  const geminiHistory: Content[] = history.map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.content }],
  }));

  const chat = model.startChat({ history: geminiHistory });

  // Track any UI commands the agent triggers
  const commands: NavigateQuranResult[] = [];

  // Send the user message
  let result = await chat.sendMessage(userMessage);

  // Tool-calling loop: keep executing tools until the agent gives a final text response
  let safety = 0;
  while (safety++ < 5) {
    const calls = result.response.functionCalls();
    if (!calls || calls.length === 0) break;

    const functionResponses: Part[] = [];

    for (const call of calls) {
      console.log(`[Tool] ${call.name}`, call.args);

      let toolResult: unknown;
      try {
        if (call.name === "log_salah") {
          toolResult = await logSalah(userId, call.args as any);
        } else if (call.name === "get_salah_stats") {
          toolResult = await getSalahStats(userId);
        } else if (call.name === "navigate_quran") {
          const navResult = await navigateQuran(userId, call.args as any);
          toolResult = navResult;
          if ("action" in navResult) {
            commands.push(navResult);
          }
        } else {
          toolResult = { error: `Unknown tool: ${call.name}` };
        }
      } catch (err: any) {
        console.error(`[Tool error] ${call.name}:`, err.message);
        toolResult = { error: err.message || "Tool execution failed" };
      }

      functionResponses.push({
        functionResponse: {
          name: call.name,
          response: { result: toolResult },
        },
      });
    }

    // Send tool results back to the model for the next step
    result = await chat.sendMessage(functionResponses);
  }

  const reply = result.response.text() || "I'm here. How can I help?";

  // Save this exchange to memory
  await saveTurn(userId, sessionId, userMessage, reply);

  return {
    reply,
    commands,
    session_id: sessionId,
  };
}
