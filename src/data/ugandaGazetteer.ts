/**
 * Uganda Gazetteer Dataset
 *
 * Pre-compiled offline coordinates and administrative regions for major cities,
 * municipalities, suburbs, and commercial trading centers across Uganda.
 * Used for offline instant typeahead geocoding and fallback address resolution.
 */

export interface OfflineGazetteerEntry {
  name: string;
  district: string;
  region: string;
  type: "city" | "suburb" | "town" | "trading_center";
  coordinates: [number, number]; // [lng, lat]
  synonyms?: string[];
}

export const UGANDA_GAZETTEER: OfflineGazetteerEntry[] = [
  // ─── Kampala Suburbs & Neighborhoods ──────────────────────────────────────────
  { name: "Kampala Central", district: "Kampala", region: "Central", type: "city", coordinates: [32.5825, 0.3163], synonyms: ["City Centre", "CBD", "Downtown"] },
  { name: "Kololo", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.5936, 0.3292], synonyms: ["Kololo Hill", "Upper Kololo"] },
  { name: "Nakasero", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.5786, 0.3228], synonyms: ["Nakasero Hill", "State House Road"] },
  { name: "Wandegeya", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.5714, 0.3347], synonyms: ["Wandegeya Market", "Bombo Road"] },
  { name: "Mulago", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.5761, 0.3392], synonyms: ["Mulago Hospital", "Upper Mulago"] },
  { name: "Makerere", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.5678, 0.3333], synonyms: ["Makerere University", "Kikoni"] },
  { name: "Kamwokya", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.5889, 0.3394], synonyms: ["Old Kira Road", "Kisementi"] },
  { name: "Bukoto", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.6006, 0.3547], synonyms: ["Bukoto Street", "Kisuule"] },
  { name: "Ntinda", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.6186, 0.3528], synonyms: ["Ntinda Complex", "Semawata", "Ntinda Stage"] },
  { name: "Kiwatule", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.6289, 0.3664], synonyms: ["Kiwatule Recreation Centre"] },
  { name: "Naalya", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.6450, 0.3700], synonyms: ["Naalya Housing", "Metroplex"] },
  { name: "Kisaasi", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.6050, 0.3686], synonyms: ["Kisaasi Trading Centre", "Kyanja Road"] },
  { name: "Kyanja", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.6092, 0.3847], synonyms: ["Kyanja Ring Road", "Kyanja Trading Centre"] },
  { name: "Kyambogo", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.6283, 0.3486], synonyms: ["Kyambogo University", "Banda"] },
  { name: "Banda", district: "Kampala", region: "Central", type: "trading_center", coordinates: [32.6361, 0.3475], synonyms: ["Banda Stage", "Jinja Road Banda"] },
  { name: "Bugolobi", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.6225, 0.3164], synonyms: ["Village Mall", "Luthuli Avenue"] },
  { name: "Luzira", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.6486, 0.3017], synonyms: ["Port Bell", "Luzira Prison", "Kitintale"] },
  { name: "Muyenga", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.6108, 0.2975], synonyms: ["Muyenga Tank Hill", "Kironde Road"] },
  { name: "Kansanga", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.6042, 0.2847], synonyms: ["Ggaba Road", "KIU"] },
  { name: "Kabalagala", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.5975, 0.2986], synonyms: ["Kabalagala Junction"] },
  { name: "Ggaba", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.6278, 0.2611], synonyms: ["Ggaba Landing Site", "Ggaba Beach"] },
  { name: "Makindye", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.5850, 0.2861], synonyms: ["Makindye Barracks", "Madindir"] },
  { name: "Nsambya", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.5892, 0.3006], synonyms: ["Nsambya Hospital", "Gaba Road"] },
  { name: "Katwe", district: "Kampala", region: "Central", type: "trading_center", coordinates: [32.5739, 0.3003], synonyms: ["Katwe Market", "Queen's Way"] },
  { name: "Mengo", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.5583, 0.3072], synonyms: ["Mengo Palace", "Bulange", "Kabaka's Palace"] },
  { name: "Rubaga", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.5519, 0.3056], synonyms: ["Rubaga Cathedral", "Hospital Road"] },
  { name: "Kasubi", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.5542, 0.3306], synonyms: ["Kasubi Tombs", "Hoima Road"] },
  { name: "Kawempe", district: "Kampala", region: "Central", type: "suburb", coordinates: [32.5572, 0.3725], synonyms: ["Kawempe Hospital", "Ttula"] },
  { name: "Bwaise", district: "Kampala", region: "Central", type: "trading_center", coordinates: [32.5625, 0.3547], synonyms: ["Bwaise Industrial", "Bombo Road Bwaise"] },
  { name: "Kalerwe", district: "Kampala", region: "Central", type: "trading_center", coordinates: [32.5736, 0.3528], synonyms: ["Kalerwe Market", "Gayaza Road"] },

  // ─── Greater Kampala Metro (Wakiso & Mukono) ──────────────────────────────────
  { name: "Kireka", district: "Wakiso", region: "Central", type: "town", coordinates: [32.6517, 0.3475], synonyms: ["Kireka Trading Centre", "Namugongo Road"] },
  { name: "Namugongo", district: "Wakiso", region: "Central", type: "town", coordinates: [32.6575, 0.3853], synonyms: ["Martyrs Shrine", "Kyaliwajjala"] },
  { name: "Kyaliwajjala", district: "Wakiso", region: "Central", type: "town", coordinates: [32.6514, 0.3789], synonyms: ["Kyaliwajjala Junction"] },
  { name: "Bweyogerere", district: "Wakiso", region: "Central", type: "town", coordinates: [32.6739, 0.3522], synonyms: ["Bweyogerere Central", "Namboole"] },
  { name: "Namboole", district: "Wakiso", region: "Central", type: "trading_center", coordinates: [32.6611, 0.3481], synonyms: ["Mandela National Stadium"] },
  { name: "Namanve", district: "Mukono", region: "Central", type: "trading_center", coordinates: [32.7056, 0.3542], synonyms: ["Namanve Industrial Park", "Jinja Road Namanve"] },
  { name: "Mukono Central", district: "Mukono", region: "Central", type: "town", coordinates: [32.7522, 0.3533], synonyms: ["Mukono Town", "UCU", "Bishop Tucker Road"] },
  { name: "Seeta", district: "Mukono", region: "Central", type: "town", coordinates: [32.7167, 0.3600], synonyms: ["Seeta Trading Centre", "Kireka-Mukono"] },
  { name: "Nansana", district: "Wakiso", region: "Central", type: "town", coordinates: [32.5317, 0.3664], synonyms: ["Nansana Municipality", "Hoima Road Nansana"] },
  { name: "Wakiso Town", district: "Wakiso", region: "Central", type: "town", coordinates: [32.4764, 0.3986], synonyms: ["Wakiso Headquarters"] },
  { name: "Entebbe Town", district: "Wakiso", region: "Central", type: "city", coordinates: [32.4637, 0.0512], synonyms: ["Entebbe Municipality", "Airport Road", "Kitoro"] },
  { name: "Kitoro", district: "Wakiso", region: "Central", type: "trading_center", coordinates: [32.4561, 0.0558], synonyms: ["Kitoro Market", "Entebbe Kitoro"] },
  { name: "Kajjansi", district: "Wakiso", region: "Central", type: "town", coordinates: [32.5397, 0.2169], synonyms: ["Entebbe Road Kajjansi", "Airfield"] },
  { name: "Zana", district: "Wakiso", region: "Central", type: "trading_center", coordinates: [32.5564, 0.2606], synonyms: ["Zana Roundabout", "Entebbe Road Zana"] },
  { name: "Seguku", district: "Wakiso", region: "Central", type: "suburb", coordinates: [32.5489, 0.2442], synonyms: ["Seguku Hill"] },
  { name: "Gayaza", district: "Wakiso", region: "Central", type: "town", coordinates: [32.6108, 0.4503], synonyms: ["Gayaza High School", "Manyangwa"] },
  { name: "Kasangati", district: "Wakiso", region: "Central", type: "town", coordinates: [32.6078, 0.4367], synonyms: ["Kasangati Resort"] },
  { name: "Bulindo", district: "Wakiso", region: "Central", type: "suburb", coordinates: [32.6489, 0.4072], synonyms: ["Kira Bulindo"] },
  { name: "Kira Town", district: "Wakiso", region: "Central", type: "town", coordinates: [32.6417, 0.3989], synonyms: ["Kira Municipality"] },

  // ─── Major Upcountry Cities & Hubs ───────────────────────────────────────────
  { name: "Jinja City", district: "Jinja", region: "Eastern", type: "city", coordinates: [33.2026, 0.4479], synonyms: ["Jinja Town", "Main Street Jinja", "Source of the Nile"] },
  { name: "Mbarara City", district: "Mbarara", region: "Western", type: "city", coordinates: [30.6585, -0.6133], synonyms: ["Mbarara Town", "High Street", "Mbarara University", "Kakoba"] },
  { name: "Gulu City", district: "Gulu", region: "Northern", type: "city", coordinates: [32.2990, 2.7747], synonyms: ["Gulu Town", "Gulu Main Market", "Churchill Drive"] },
  { name: "Mbale City", district: "Mbale", region: "Eastern", type: "city", coordinates: [34.1750, 1.0784], synonyms: ["Mbale Town", "Republic Street", "Mount Elgon"] },
  { name: "Masaka City", district: "Masaka", region: "Central", type: "city", coordinates: [31.7341, -0.3341], synonyms: ["Masaka Town", "Hobart Street", "Nyendo"] },
  { name: "Lira City", district: "Lira", region: "Northern", type: "city", coordinates: [32.9000, 2.2500], synonyms: ["Lira Town", "Obote Avenue"] },
  { name: "Fort Portal City", district: "Kabarole", region: "Western", type: "city", coordinates: [30.2747, 0.6545], synonyms: ["Fort Portal Tourism City", "Kabarole"] },
  { name: "Arua City", district: "Arua", region: "Northern", type: "city", coordinates: [30.9111, 3.0306], synonyms: ["Arua Town", "Avenue Road Arua"] },
  { name: "Soroti City", district: "Soroti", region: "Eastern", type: "city", coordinates: [33.6111, 1.7147], synonyms: ["Soroti Town", "Flying School"] },
  { name: "Hoima City", district: "Hoima", region: "Western", type: "city", coordinates: [31.3524, 1.4331], synonyms: ["Hoima Oil City", "Main Street Hoima"] },
  { name: "Kabale Town", district: "Kabale", region: "Western", type: "town", coordinates: [29.9889, -1.2528], synonyms: ["Kabale Municipality", "Kigezi"] },
  { name: "Tororo Town", district: "Tororo", region: "Eastern", type: "town", coordinates: [34.1809, 0.6928], synonyms: ["Tororo Rock"] },
  { name: "Kasese Town", district: "Kasese", region: "Western", type: "town", coordinates: [30.0833, 0.1833], synonyms: ["Rwenzori Road"] },
  { name: "Busia Town", district: "Busia", region: "Eastern", type: "town", coordinates: [34.0903, 0.4678], synonyms: ["Busia Border"] },
  { name: "Iganga Town", district: "Iganga", region: "Eastern", type: "town", coordinates: [33.4686, 0.6089], synonyms: ["Iganga Main Street"] },
  { name: "Masindi Town", district: "Masindi", region: "Western", type: "town", coordinates: [31.7150, 1.6744], synonyms: ["Masindi Port Road"] },
  { name: "Mityana Town", district: "Mityana", region: "Central", type: "town", coordinates: [32.0461, 0.3986], synonyms: ["Mityana Municipality"] },
  { name: "Mubende Town", district: "Mubende", region: "Central", type: "town", coordinates: [31.3931, 0.5606], synonyms: ["Mubende District"] },
  { name: "Lugazi Town", district: "Buikwe", region: "Central", type: "town", coordinates: [32.9367, 0.3775], synonyms: ["Lugazi Sugar"] },
  { name: "Kitgum Town", district: "Kitgum", region: "Northern", type: "town", coordinates: [32.8806, 3.2944], synonyms: ["Kitgum Main Market"] },
  { name: "Nebbi Town", district: "Nebbi", region: "Northern", type: "town", coordinates: [31.0889, 2.4789], synonyms: ["Nebbi Municipality"] },
  { name: "Moroto Town", district: "Moroto", region: "Northern", type: "town", coordinates: [34.6667, 2.5333], synonyms: ["Karamoja Hub"] },
];

/**
 * Searches the offline Uganda gazetteer by query string.
 * Supports partial matches on name, district, region, and synonyms.
 */
export function searchOfflineUgandaGazetteer(
  query: string,
  limit = 6
): OfflineGazetteerEntry[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  const matched: { entry: OfflineGazetteerEntry; score: number }[] = [];

  for (const entry of UGANDA_GAZETTEER) {
    const nameLower = entry.name.toLowerCase();
    const districtLower = entry.district.toLowerCase();

    let score = 0;
    if (nameLower === q) {
      score = 100;
    } else if (nameLower.startsWith(q)) {
      score = 80;
    } else if (nameLower.includes(q)) {
      score = 60;
    } else if (districtLower.startsWith(q)) {
      score = 40;
    } else if (entry.synonyms?.some((s) => s.toLowerCase().includes(q))) {
      score = 50;
    }

    if (score > 0) {
      matched.push({ entry, score });
    }
  }

  matched.sort((a, b) => b.score - a.score);
  return matched.slice(0, limit).map((m) => m.entry);
}
