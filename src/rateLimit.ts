import * as admin from "firebase-admin";

const DAILY_LIMIT = 50; // messages per user per day

/**
 * Enforces a daily rate limit per user.
 * Throws an error if the limit is exceeded.
 */
export async function checkRateLimit(userId: string): Promise<void> {
  const db = admin.firestore();
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const ref = db.doc(`users/${userId}/agent_meta/rate_${today}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = (snap.exists ? snap.data()?.count : 0) || 0;

    if (count >= DAILY_LIMIT) {
      throw new Error(
        `Daily message limit reached (${DAILY_LIMIT}). Please come back tomorrow, InshaAllah.`
      );
    }

    tx.set(ref, {
      count: count + 1,
      updated_at: admin.firestore.Timestamp.now(),
    });
  });
}
