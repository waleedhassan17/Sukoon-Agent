import * as admin from "firebase-admin";

// Surah name to number mapping (handles common variants)
const SURAH_MAP: Record<string, number> = {
  "al-fatiha": 1, "fatiha": 1, "fatihah": 1,
  "al-baqarah": 2, "baqarah": 2, "baqara": 2,
  "al-imran": 3, "imran": 3, "ali-imran": 3,
  "an-nisa": 4, "nisa": 4,
  "al-maidah": 5, "maidah": 5,
  "al-anam": 6, "anam": 6,
  "al-araf": 7, "araf": 7,
  "al-anfal": 8, "anfal": 8,
  "at-tawbah": 9, "tawbah": 9, "tawba": 9,
  "yunus": 10,
  "hud": 11,
  "yusuf": 12,
  "ar-rad": 13, "rad": 13,
  "ibrahim": 14,
  "al-hijr": 15, "hijr": 15,
  "an-nahl": 16, "nahl": 16,
  "al-isra": 17, "isra": 17, "bani-israil": 17,
  "al-kahf": 18, "kahf": 18,
  "maryam": 19,
  "ta-ha": 20, "taha": 20,
  "al-anbiya": 21, "anbiya": 21,
  "al-hajj": 22, "hajj": 22,
  "al-muminun": 23, "muminun": 23,
  "an-nur": 24, "nur": 24,
  "al-furqan": 25, "furqan": 25,
  "ash-shuara": 26, "shuara": 26,
  "an-naml": 27, "naml": 27,
  "al-qasas": 28, "qasas": 28,
  "al-ankabut": 29, "ankabut": 29,
  "ar-rum": 30, "rum": 30,
  "luqman": 31,
  "as-sajdah": 32, "sajdah": 32,
  "al-ahzab": 33, "ahzab": 33,
  "saba": 34,
  "fatir": 35,
  "ya-sin": 36, "yasin": 36, "yaseen": 36,
  "as-saffat": 37, "saffat": 37,
  "sad": 38,
  "az-zumar": 39, "zumar": 39,
  "ghafir": 40, "al-mumin": 40,
  "fussilat": 41, "ha-mim-sajdah": 41,
  "ash-shura": 42, "shura": 42,
  "az-zukhruf": 43, "zukhruf": 43,
  "ad-dukhan": 44, "dukhan": 44,
  "al-jathiyah": 45, "jathiyah": 45,
  "al-ahqaf": 46, "ahqaf": 46,
  "muhammad": 47,
  "al-fath": 48, "fath": 48,
  "al-hujurat": 49, "hujurat": 49,
  "qaf": 50,
  "adh-dhariyat": 51, "dhariyat": 51,
  "at-tur": 52, "tur": 52,
  "an-najm": 53, "najm": 53,
  "al-qamar": 54, "qamar": 54,
  "ar-rahman": 55, "rahman": 55,
  "al-waqiah": 56, "waqiah": 56, "waqia": 56,
  "al-hadid": 57, "hadid": 57,
  "al-mujadilah": 58, "mujadilah": 58,
  "al-hashr": 59, "hashr": 59,
  "al-mumtahanah": 60, "mumtahanah": 60,
  "as-saff": 61, "saff": 61,
  "al-jumuah": 62, "jumuah": 62,
  "al-munafiqun": 63, "munafiqun": 63,
  "at-taghabun": 64, "taghabun": 64,
  "at-talaq": 65, "talaq": 65,
  "at-tahrim": 66, "tahrim": 66,
  "al-mulk": 67, "mulk": 67,
  "al-qalam": 68, "qalam": 68,
  "al-haqqah": 69, "haqqah": 69,
  "al-maarij": 70, "maarij": 70,
  "nuh": 71,
  "al-jinn": 72, "jinn": 72,
  "al-muzzammil": 73, "muzzammil": 73,
  "al-muddaththir": 74, "muddaththir": 74,
  "al-qiyamah": 75, "qiyamah": 75,
  "al-insan": 76, "insan": 76, "ad-dahr": 76,
  "al-mursalat": 77, "mursalat": 77,
  "an-naba": 78, "naba": 78,
  "an-naziat": 79, "naziat": 79,
  "abasa": 80,
  "at-takwir": 81, "takwir": 81,
  "al-infitar": 82, "infitar": 82,
  "al-mutaffifin": 83, "mutaffifin": 83,
  "al-inshiqaq": 84, "inshiqaq": 84,
  "al-buruj": 85, "buruj": 85,
  "at-tariq": 86, "tariq": 86,
  "al-ala": 87, "ala": 87,
  "al-ghashiyah": 88, "ghashiyah": 88,
  "al-fajr": 89, "fajr-surah": 89,
  "al-balad": 90, "balad": 90,
  "ash-shams": 91, "shams": 91,
  "al-lail": 92, "lail": 92,
  "ad-duha": 93, "duha": 93,
  "ash-sharh": 94, "sharh": 94, "al-inshirah": 94,
  "at-tin": 95, "tin": 95,
  "al-alaq": 96, "alaq": 96,
  "al-qadr": 97, "qadr": 97,
  "al-bayyinah": 98, "bayyinah": 98,
  "az-zalzalah": 99, "zalzalah": 99,
  "al-adiyat": 100, "adiyat": 100,
  "al-qariah": 101, "qariah": 101,
  "at-takathur": 102, "takathur": 102,
  "al-asr": 103, "asr-surah": 103,
  "al-humazah": 104, "humazah": 104,
  "al-fil": 105, "fil": 105,
  "quraysh": 106, "quraish": 106,
  "al-maun": 107, "maun": 107,
  "al-kawthar": 108, "kawthar": 108,
  "al-kafirun": 109, "kafirun": 109,
  "an-nasr": 110, "nasr": 110,
  "al-masad": 111, "masad": 111, "al-lahab": 111,
  "al-ikhlas": 112, "ikhlas": 112,
  "al-falaq": 113, "falaq": 113,
  "an-nas": 114, "nas": 114,
};

export interface NavigateQuranArgs {
  surah: number | string;
  ayah?: number;
}

export interface NavigateQuranResult {
  action: "navigate_quran";
  surah: number;
  ayah: number;
  surah_name: string;
  message: string;
}

const SURAH_NAMES = [
  "Al-Fatiha", "Al-Baqarah", "Ali 'Imran", "An-Nisa", "Al-Ma'idah",
  "Al-An'am", "Al-A'raf", "Al-Anfal", "At-Tawbah", "Yunus",
  "Hud", "Yusuf", "Ar-Ra'd", "Ibrahim", "Al-Hijr",
  "An-Nahl", "Al-Isra", "Al-Kahf", "Maryam", "Ta-Ha",
  "Al-Anbiya", "Al-Hajj", "Al-Mu'minun", "An-Nur", "Al-Furqan",
  "Ash-Shu'ara", "An-Naml", "Al-Qasas", "Al-Ankabut", "Ar-Rum",
  "Luqman", "As-Sajdah", "Al-Ahzab", "Saba", "Fatir",
  "Ya-Sin", "As-Saffat", "Sad", "Az-Zumar", "Ghafir",
  "Fussilat", "Ash-Shura", "Az-Zukhruf", "Ad-Dukhan", "Al-Jathiyah",
  "Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hujurat", "Qaf",
  "Adh-Dhariyat", "At-Tur", "An-Najm", "Al-Qamar", "Ar-Rahman",
  "Al-Waqi'ah", "Al-Hadid", "Al-Mujadilah", "Al-Hashr", "Al-Mumtahanah",
  "As-Saff", "Al-Jumu'ah", "Al-Munafiqun", "At-Taghabun", "At-Talaq",
  "At-Tahrim", "Al-Mulk", "Al-Qalam", "Al-Haqqah", "Al-Ma'arij",
  "Nuh", "Al-Jinn", "Al-Muzzammil", "Al-Muddaththir", "Al-Qiyamah",
  "Al-Insan", "Al-Mursalat", "An-Naba", "An-Nazi'at", "Abasa",
  "At-Takwir", "Al-Infitar", "Al-Mutaffifin", "Al-Inshiqaq", "Al-Buruj",
  "At-Tariq", "Al-A'la", "Al-Ghashiyah", "Al-Fajr", "Al-Balad",
  "Ash-Shams", "Al-Lail", "Ad-Duha", "Ash-Sharh", "At-Tin",
  "Al-Alaq", "Al-Qadr", "Al-Bayyinah", "Az-Zalzalah", "Al-Adiyat",
  "Al-Qari'ah", "At-Takathur", "Al-Asr", "Al-Humazah", "Al-Fil",
  "Quraysh", "Al-Ma'un", "Al-Kawthar", "Al-Kafirun", "An-Nasr",
  "Al-Masad", "Al-Ikhlas", "Al-Falaq", "An-Nas",
];

/**
 * Parses surah identifier (number or name) into surah number.
 * Saves user's progress to Firestore.
 * Returns navigation command for the Flutter app.
 */
export async function navigateQuran(
  userId: string,
  args: NavigateQuranArgs
): Promise<NavigateQuranResult | { error: string }> {
  let surahNum: number;

  if (typeof args.surah === "number") {
    surahNum = args.surah;
  } else {
    const normalized = String(args.surah)
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/^surah-?/i, "")
      .replace(/'/g, "")
      .trim();
    surahNum = SURAH_MAP[normalized] || parseInt(normalized, 10);
  }

  if (!surahNum || surahNum < 1 || surahNum > 114) {
    return { error: `Could not resolve "${args.surah}" to a surah number (1-114).` };
  }

  const ayah = Math.max(1, Number(args.ayah) || 1);

  // Save reading progress
  const db = admin.firestore();
  await db.collection(`users/${userId}/quran_progress`).add({
    surah: surahNum,
    ayah,
    updated_at: admin.firestore.Timestamp.now(),
  });

  const surahName = SURAH_NAMES[surahNum - 1];

  return {
    action: "navigate_quran",
    surah: surahNum,
    ayah,
    surah_name: surahName,
    message: `Navigating to Surah ${surahName} (${surahNum}), Ayah ${ayah}`,
  };
}
