import * as admin from "firebase-admin";

const VALID_PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;
type Prayer = typeof VALID_PRAYERS[number];

export interface LogSalahArgs {
  prayer: string;
  on_time?: boolean;
}

/**
 * Logs a completed prayer for a user.
 * Validates prayer name, prevents duplicate logging for the same prayer on the same day.
 */
export async function logSalah(
  userId: string,
  args: LogSalahArgs
): Promise<{ success: boolean; message: string }> {
  const prayer = args.prayer?.toLowerCase().trim() as Prayer;

  // Validate prayer name
  if (!VALID_PRAYERS.includes(prayer)) {
    return {
      success: false,
      message: `Invalid prayer name. Must be one of: ${VALID_PRAYERS.join(", ")}`,
    };
  }

  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  // Check if this prayer was already logged today (prevent duplicates)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const existing = await db
    .collection(`users/${userId}/salah_logs`)
    .where("prayer", "==", prayer)
    .where("prayed_at", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
    .limit(1)
    .get();

  if (!existing.empty) {
    return {
      success: false,
      message: `You've already logged ${prayer} today, MashaAllah.`,
    };
  }

  // Write the prayer log
  await db.collection(`users/${userId}/salah_logs`).add({
    prayer,
    prayed_at: now,
    on_time: args.on_time !== false, // default true
    created_at: now,
  });

  return {
    success: true,
    message: `Logged ${prayer} prayer successfully.`,
  };
}
