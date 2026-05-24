# Claude Code Prompt — Copy & Paste This

When you open Claude Code in this project folder, paste this entire prompt as your first message:

---

I have a complete TypeScript Express server in this folder that runs an AI agent for my Islamic companion app called Sukoon. Read the README.md file first — it has the full project overview, architecture, and deployment instructions.

The code is already written, type-checked, and tested. **Do not rewrite the agent code.** Your job is to help me:

1. Deploy this to Render.com (free tier, no credit card needed) since I can't enable Firebase Blaze plan
2. Test that the deployed endpoint works
3. Integrate it into my existing React Native app (the Sukoon app, already live on Play Store with 500+ downloads)

My Firebase project uses anonymous authentication and is already set up. I have Firebase project credentials and a Gemini API key ready.

Please walk me through this step-by-step, one step at a time. Don't dump the entire deployment guide on me at once — guide me through each phase, wait for me to confirm completion, then move to the next.

Start by:
1. Reading the README.md so you understand the project
2. Checking that the code structure is intact (src/index.ts, src/agent.ts, src/tools/, etc.)
3. Running `npm install` and `npx tsc --noEmit` to confirm the code still compiles cleanly
4. Then ask me what I have ready (Gemini key? Firebase service account JSON? GitHub account?) and proceed from there

When integrating with React Native later, the chat screen needs to:
- Use my existing Firebase Auth (anonymous)
- Send messages to the deployed agent URL
- Display the agent's replies in a chat UI
- Handle `navigate_quran` commands by routing to my existing Quran reader screen
- Show errors gracefully (rate limit, network, etc.)

Important constraints:
- I'm on Firebase Spark (free) plan — no Cloud Functions
- The agent must verify Firebase Auth tokens server-side (already implemented in src/index.ts)
- Per-user rate limiting (50 msgs/day) is already implemented — don't change it
- All secrets must go in env vars, never in code

Let's start. Read the README and tell me what you found.

---

# After Claude Code finishes deployment

Once your agent is deployed and you have the URL, come back here (the original Claude conversation) with:
- Your deployed URL (something like https://sukoon-agent.onrender.com)
- The result of `curl https://YOUR-URL/` (should return `{"status":"ok","service":"sukoon-agent"}`)
- Any errors you hit during deployment

I'll then help you with the React Native integration in detail, and we'll plan the rollout strategy for your live 500+ users.
