import * as admin from "firebase-admin";

interface PrayerCounts {
  fajr: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

export interface SalahStats {
  summary: string;
  breakdown: PrayerCounts;
  total_logged: number;
  total_possible: number;
  consistency_percent: number;
  weakest_prayer: string;
  current_streak_days: number;
}

/**
 * Fetches the user's prayer activity for the last 7 days
 * and computes summary stats for the agent to reason over.
 */
export async function getSalahStats(userId: string): Promise<SalahStats> {
  const db = admin.firestore();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const snapshot = await db
    .collection(`users/${userId}/salah_logs`)
    .where("prayed_at", ">=", admin.firestore.Timestamp.fromDate(sevenDaysAgo))
    .orderBy("prayed_at", "desc")
    .get();

  const logs = snapshot.docs.map((d) => d.data());

  // Count by prayer
  const counts: PrayerCounts = { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 };
  logs.forEach((log) => {
    const p = (log.prayer || "").toLowerCase();
    if (p in counts) counts[p as keyof PrayerCounts]++;
  });

  const totalLogged = logs.length;
  const totalPossible = 7 * 5;
  const consistency = Math.round((totalLogged / totalPossible) * 100);

  // Find weakest prayer
  let weakest: keyof PrayerCounts = "fajr";
  let min = counts.fajr;
  (Object.keys(counts) as Array<keyof PrayerCounts>).forEach((p) => {
    if (counts[p] < min) {
      weakest = p;
      min = counts[p];
    }
  });

  // Compute current streak (consecutive days with all 5 prayers)
  const dayBuckets = new Map<string, Set<string>>();
  logs.forEach((log) => {
    const date = (log.prayed_at as admin.firestore.Timestamp).toDate();
    const key = date.toISOString().split("T")[0];
    if (!dayBuckets.has(key)) dayBuckets.set(key, new Set());
    dayBuckets.get(key)!.add(log.prayer);
  });

  let streak = 0;
  for (let i = 0; i < 7; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const key = day.toISOString().split("T")[0];
    const prayed = dayBuckets.get(key);
    if (prayed && prayed.size === 5) {
      streak++;
    } else {
      break;
    }
  }

  return {
    summary: `Last 7 days: ${totalLogged}/${totalPossible} prayers (${consistency}%). Fajr: ${counts.fajr}/7, Dhuhr: ${counts.dhuhr}/7, Asr: ${counts.asr}/7, Maghrib: ${counts.maghrib}/7, Isha: ${counts.isha}/7. Weakest: ${weakest}. Current streak: ${streak} day(s).`,
    breakdown: counts,
    total_logged: totalLogged,
    total_possible: totalPossible,
    consistency_percent: consistency,
    weakest_prayer: weakest,
    current_streak_days: streak,
  };
}
