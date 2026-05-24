import * as admin from "firebase-admin";

const MAX_HISTORY = 10; // last N exchanges to keep as context

export interface ChatTurn {
  role: "user" | "model";
  content: string;
  created_at: admin.firestore.Timestamp;
}

/**
 * Loads the most recent conversation turns for a session.
 */
export async function loadHistory(
  userId: string,
  sessionId: string
): Promise<ChatTurn[]> {
  const db = admin.firestore();
  const snap = await db
    .collection(`users/${userId}/agent_sessions/${sessionId}/turns`)
    .orderBy("created_at", "desc")
    .limit(MAX_HISTORY * 2) // user + model = one exchange
    .get();

  return snap.docs.map((d) => d.data() as ChatTurn).reverse();
}

/**
 * Appends a user message and the agent's reply to the session history.
 */
export async function saveTurn(
  userId: string,
  sessionId: string,
  userMessage: string,
  agentReply: string
): Promise<void> {
  const db = admin.firestore();
  const batch = db.batch();
  const colRef = db.collection(`users/${userId}/agent_sessions/${sessionId}/turns`);
  const now = admin.firestore.Timestamp.now();

  batch.set(colRef.doc(), {
    role: "user",
    content: userMessage,
    created_at: now,
  });

  batch.set(colRef.doc(), {
    role: "model",
    content: agentReply,
    created_at: admin.firestore.Timestamp.fromMillis(now.toMillis() + 1),
  });

  // Update session metadata
  batch.set(
    db.doc(`users/${userId}/agent_sessions/${sessionId}`),
    {
      last_active: now,
      message_count: admin.firestore.FieldValue.increment(2),
    },
    { merge: true }
  );

  await batch.commit();
}
