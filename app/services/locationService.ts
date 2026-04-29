// app/services/locationService.ts  —  strogi OSM filteri po kategoriji

export interface Place {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type:
    | "restaurant"
    | "cafe"
    | "club"
    | "beach"
    | "landmark"
    | "opg"
    | "accommodation"
    | "market"
    | "paintball"
    | "cinema"
    | "park"
    | "escapeRoom"
    | "museum"
    | "theater"
    | "mountain"
    | "nationalPark"
    | "cave"
    | "spa";
  rating?: number;
  address?: string;
  description?: string;
  distance?: number;
  phone?: string;
  website?: string;
  openingHours?: string;
}

export const placeCategories: Record<
  string,
  { icon: string; color: string; marker: string; osmTag: string }
> = {
  restaurant: {
    icon: "🍽️",
    color: "#FF6B6B",
    marker: "restaurant",
    osmTag: "amenity=restaurant",
  },
  cafe: {
    icon: "☕",
    color: "#4ECDC4",
    marker: "cafe",
    osmTag: "amenity=cafe",
  },
  club: {
    icon: "🎵",
    color: "#9B59B6",
    marker: "club",
    osmTag: "amenity=nightclub",
  },
  beach: {
    icon: "🏖️",
    color: "#3498DB",
    marker: "beach",
    osmTag: "natural=beach",
  },
  landmark: {
    icon: "🏰",
    color: "#F1C40F",
    marker: "landmark",
    osmTag: "historic=*",
  },
  opg: {
    icon: "🌾",
    color: "#2ECC71",
    marker: "opg",
    osmTag: "shop=farm",
  },
  accommodation: {
    icon: "🏨",
    color: "#E67E22",
    marker: "accommodation",
    osmTag: "tourism=hotel",
  },
  market: {
    icon: "🛒",
    color: "#27AE60",
    marker: "market",
    osmTag: "amenity=marketplace",
  },
  paintball: {
    icon: "🎯",
    color: "#E74C3C",
    marker: "paintball",
    osmTag: "sport=paintball",
  },
  cinema: {
    icon: "🎬",
    color: "#8E44AD",
    marker: "cinema",
    osmTag: "amenity=cinema",
  },
  park: {
    icon: "🌳",
    color: "#27AE60",
    marker: "park",
    osmTag: "leisure=park",
  },
  escapeRoom: {
    icon: "🔐",
    color: "#F39C12",
    marker: "escape_room",
    osmTag: "leisure=escape_game",
  },
  museum: {
    icon: "🏛️",
    color: "#8E44AD",
    marker: "museum",
    osmTag: "tourism=museum",
  },
  theater: {
    icon: "🎭",
    color: "#D35400",
    marker: "theatre",
    osmTag: "amenity=theatre",
  },
  mountain: {
    icon: "⛰️",
    color: "#7F8C8D",
    marker: "mountain",
    osmTag: "natural=peak",
  },
  nationalPark: {
    icon: "🏞️",
    color: "#2ECC71",
    marker: "national_park",
    osmTag: "boundary=national_park",
  },
  cave: {
    icon: "🕳️",
    color: "#95A5A6",
    marker: "cave",
    osmTag: "natural=cave_entrance",
  },
  spa: {
    icon: "💧",
    color: "#1ABC9C",
    marker: "spa",
    osmTag: "amenity=spa",
  },
};

// ─── Strogi OSM filteri po kategoriji ────────────────────────────────────────
//
// Svaka kategorija ima BIJELU listu tagova koji su jedini prihvaćeni.
// Ime mjesta se dodatno provjerava crnom listom zabranjenih ključnih riječi.

interface CategoryRule {
  // Overpass node queries (OR logika između elemenata liste)
  queries: string[];
  // Bijela lista — tag ključ + vrijednost koja MORA biti prisutna
  whitelist: { key: string; values: string[] }[];
  // Crna lista — ako ime sadrži ove riječi, izbaci rezultat
  nameDenylist: string[];
}

const CATEGORY_RULES: Record<string, CategoryRule> = {
  restaurant: {
    queries: ['node["amenity"="restaurant"]'],
    whitelist: [{ key: "amenity", values: ["restaurant"] }],
    nameDenylist: [
      "hotel",
      "hostel",
      "apartman",
      "soba",
      "prenočište",
      "guest",
      "inn",
      "rooms",
    ],
  },
  cafe: {
    queries: ['node["amenity"="cafe"]', 'node["amenity"="coffee_shop"]'],
    whitelist: [{ key: "amenity", values: ["cafe", "coffee_shop"] }],
    nameDenylist: ["hotel", "hostel", "apartman", "soba", "prenočište"],
  },
  club: {
    queries: [
      'node["amenity"="nightclub"]',
      'node["amenity"="bar"]["club"="yes"]',
    ],
    whitelist: [{ key: "amenity", values: ["nightclub", "bar"] }],
    nameDenylist: ["hotel", "hostel", "apartman", "soba", "prenočište"],
  },

  // Plaža = samo natural=beach — mora biti fizička plaža, ne objekt
  beach: {
    queries: [
      'node["natural"="beach"]',
      'way["natural"="beach"]',
      'relation["natural"="beach"]',
    ],
    whitelist: [{ key: "natural", values: ["beach"] }],
    nameDenylist: [
      "hotel",
      "hostel",
      "apartman",
      "soba",
      "prenočište",
      "guest house",
      "centar",
      "dom",
      "house",
      "rooms",
      "inn",
      "pension",
      "studio",
      "it",
      "d.o.o",
      "nekretnin",
    ],
  },

  // Znamenitosti = samo trajne povijesne znamenitosti bez sezonskih događanja
  landmark: {
    queries: [
      'node["historic"]',
      'node["tourism"="attraction"]',
      'way["historic"]',
      'way["tourism"="attraction"]',
    ],
    whitelist: [
      {
        key: "historic",
        values: [
          "castle",
          "monument",
          "memorial",
          "ruins",
          "archaeological_site",
          "building",
          "fort",
          "church",
          "city_gate",
          "manor",
          "milestone",
          "aircraft",
          "ship",
          "locomotive",
          "tank",
          "yes",
        ],
      },
      { key: "tourism", values: ["attraction"] },
    ],
    nameDenylist: [
      "advent",
      "božić",
      "christmas",
      "sajam",
      "festival",
      "kino",
      "klub",
      "hotel",
      "hostel",
      "apartman",
      "soba",
      "prenočište",
      "guest",
      "it",
      "d.o.o",
      "nekretnin",
      "centar nekretnina",
    ],
  },

  // OPG = obiteljska poljoprivredna gospodarstva — naziv mora počinjati s "OPG"
  opg: {
    queries: [
      'node["shop"="farm"]',
      'node["landuse"="farmyard"]',
      'node["produce"]',
      'node["farm"="yes"]',
    ],
    whitelist: [
      { key: "shop", values: ["farm"] },
      { key: "landuse", values: ["farmyard", "farm"] },
      { key: "produce", values: ["*"] },
    ],
    nameDenylist: [
      "hotel",
      "hostel",
      "apartman",
      "soba",
      "prenočište",
      "guest",
      "it",
      "d.o.o",
      "nekretnin",
      "centar",
      "park",
      "studio",
    ],
  },

  // Smještaji = hoteli, hosteli, apartmani, sobe, prenočišta
  accommodation: {
    queries: [
      'node["tourism"="hotel"]',
      'node["tourism"="hostel"]',
      'node["tourism"="apartment"]',
      'node["tourism"="guest_house"]',
      'node["tourism"="motel"]',
      'node["tourism"="bed_and_breakfast"]',
      'way["tourism"="hotel"]',
      'way["tourism"="hostel"]',
      'way["tourism"="apartment"]',
      'way["tourism"="guest_house"]',
    ],
    whitelist: [
      {
        key: "tourism",
        values: [
          "hotel",
          "hostel",
          "apartment",
          "guest_house",
          "motel",
          "bed_and_breakfast",
        ],
      },
    ],
    nameDenylist: [
      "it",
      "d.o.o",
      "nekretnin",
      "centar",
      "park",
      "fitness",
      "kozmetik",
      "studio kozmetik",
      "salon",
      "ambulanta",
      "ljekarnica",
    ],
  },

  // Tržnica = uređen prostor za prodaju hrane i poljopr. proizvoda
  market: {
    queries: ['node["amenity"="marketplace"]', 'way["amenity"="marketplace"]'],
    whitelist: [{ key: "amenity", values: ["marketplace"] }],
    nameDenylist: [
      "hotel",
      "hostel",
      "apartman",
      "soba",
      "prenočište",
      "guest",
      "it",
      "d.o.o",
      "nekretnin",
      "centar",
      "shopping",
    ],
  },

  // Paintball = strogo sportski teren za paintball
  paintball: {
    queries: [
      'node["sport"="paintball"]',
      'node["leisure"="sports_centre"]["sport"="paintball"]',
    ],
    whitelist: [{ key: "sport", values: ["paintball"] }],
    nameDenylist: [
      "hotel",
      "hostel",
      "apartman",
      "soba",
      "prenočište",
      "guest",
      "it",
      "d.o.o",
      "nekretnin",
      "centar",
    ],
  },

  cinema: {
    queries: ['node["amenity"="cinema"]', 'way["amenity"="cinema"]'],
    whitelist: [{ key: "amenity", values: ["cinema"] }],
    nameDenylist: ["hotel", "hostel", "apartman", "it", "nekretnin"],
  },

  // Park = uređena zelena površina za odmor, ne perivoj/atrakcija
  park: {
    queries: [
      'node["leisure"="park"]',
      'way["leisure"="park"]',
      'relation["leisure"="park"]',
    ],
    whitelist: [{ key: "leisure", values: ["park"] }],
    nameDenylist: [
      "perivoj",
      "dvorac",
      "tvrđava",
      "advent",
      "festival",
      "sajam",
      "hotel",
      "hostel",
      "apartman",
      "soba",
      "prenočište",
      "guest",
      "it",
      "d.o.o",
      "nekretnin",
      "centar",
    ],
  },

  // Escape Room = soba za bijeg, interaktivna igra
  escapeRoom: {
    queries: ['node["leisure"="escape_game"]', 'node["amenity"="escape_game"]'],
    whitelist: [
      { key: "leisure", values: ["escape_game"] },
      { key: "amenity", values: ["escape_game"] },
    ],
    nameDenylist: [
      "hotel",
      "hostel",
      "apartman",
      "soba",
      "prenočište",
      "guest",
      "it",
      "d.o.o",
      "nekretnin",
      "centar",
    ],
  },

  // Muzej = institucija koja čuva i izlaže baštinu
  museum: {
    queries: ['node["tourism"="museum"]', 'way["tourism"="museum"]'],
    whitelist: [{ key: "tourism", values: ["museum"] }],
    nameDenylist: [
      "catacomb",
      "catacombe",
      "atrakcija",
      "hotel",
      "hostel",
      "apartman",
      "soba",
      "prenočište",
      "guest",
      "it",
      "d.o.o",
      "nekretnin",
    ],
  },

  // Kazalište = zgrada/ustanova za scenska izvođenja
  theater: {
    queries: ['node["amenity"="theatre"]', 'way["amenity"="theatre"]'],
    whitelist: [{ key: "amenity", values: ["theatre"] }],
    nameDenylist: [
      "osiguranje",
      "banka",
      "hotel",
      "hostel",
      "apartman",
      "it",
      "d.o.o",
      "nekretnin",
      "centar",
    ],
  },

  // Planina = prirodni vrh / uzvišenje
  mountain: {
    queries: ['node["natural"="peak"]', 'node["natural"="hill"]'],
    whitelist: [{ key: "natural", values: ["peak", "hill"] }],
    nameDenylist: [
      "hotel",
      "hostel",
      "apartman",
      "soba",
      "prenočište",
      "guest",
      "it",
      "d.o.o",
      "nekretnin",
      "centar",
    ],
  },

  // Nacionalni park = zaštićeno prirodno područje
  nationalPark: {
    queries: [
      'relation["boundary"="national_park"]',
      'relation["boundary"="protected_area"]["protect_class"="2"]',
      'node["boundary"="national_park"]',
    ],
    whitelist: [
      { key: "boundary", values: ["national_park", "protected_area"] },
      { key: "leisure", values: ["nature_reserve"] },
    ],
    nameDenylist: [
      "hotel",
      "hostel",
      "apartman",
      "soba",
      "prenočište",
      "guest",
      "it",
      "d.o.o",
      "nekretnin",
      "centar",
    ],
  },

  // Špilja = prirodna podzemna šupljina
  cave: {
    queries: [
      'node["natural"="cave_entrance"]',
      'way["natural"="cave_entrance"]',
    ],
    whitelist: [{ key: "natural", values: ["cave_entrance"] }],
    nameDenylist: [
      "hotel",
      "hostel",
      "apartman",
      "soba",
      "prenočište",
      "guest",
      "it",
      "d.o.o",
      "nekretnin",
      "centar",
      "perla inn",
    ],
  },

  // Toplice = prirodni termalni/mineralni izvori i lječilišta
  spa: {
    queries: [
      'node["amenity"="spa"]',
      'node["leisure"="spa"]',
      'node["leisure"="water_park"]',
      'node["natural"="hot_spring"]',
    ],
    whitelist: [
      { key: "amenity", values: ["spa"] },
      { key: "leisure", values: ["spa", "water_park"] },
      { key: "natural", values: ["hot_spring"] },
    ],
    nameDenylist: [
      "ambulanta",
      "beauty",
      "kozmetik",
      "salon",
      "estetika",
      "fizioterapija",
      "tensegrity",
      "fitness",
      "obrt",
      "ljekarnica",
      "apoteka",
      "hotel",
      "hostel",
      "apartman",
      "it",
      "d.o.o",
      "nekretnin",
    ],
  },
};

// ─── Globalna crna lista naziva koji se NIKADA ne smiju prikazati ─────────────
const GLOBAL_NAME_DENYLIST = [
  "mono d.o.o",
  "centar nekretnina",
  "it park",
  "nekretnin",
];

// ─── Cache ────────────────────────────────────────────────────────────────────
let placesCache: Map<string, { places: Place[]; timestamp: number }> =
  new Map();
const CACHE_DURATION = 5 * 60 * 1000;

export const clearPlacesCache = () => {
  placesCache.clear();
};

// ─── Geocode city ─────────────────────────────────────────────────────────────
export interface GeocodedCity {
  latitude: number;
  longitude: number;
  displayName: string;
}

export const geocodeCity = async (
  query: string,
): Promise<GeocodedCity | null> => {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "CroMapApp/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      displayName:
        data[0].display_name?.split(",").slice(0, 2).join(", ") || query,
    };
  } catch {
    return null;
  }
};

// ─── Pretraga po imenu ────────────────────────────────────────────────────────
export const searchPlaces = async (
  query: string,
  lat?: number,
  lon?: number,
): Promise<Place[]> => {
  if (!query.trim()) return [];
  try {
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1`;
    if (lat && lon) url += `&lat=${lat}&lon=${lon}`;

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, {
      headers: { "User-Agent": "CroMapApp/1.0" },
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => ({
      id: item.place_id?.toString() || Date.now().toString(),
      name: item.display_name?.split(",")[0] || "Nepoznato",
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      type: "landmark" as Place["type"],
      address: item.display_name,
    }));
  } catch {
    return [];
  }
};

// ─── Haversine (helper) ───────────────────────────────────────────────────────
const haversineKm = (
  a1: number,
  o1: number,
  a2: number,
  o2: number,
): number => {
  const R = 6371,
    dA = ((a2 - a1) * Math.PI) / 180,
    dO = ((o2 - o1) * Math.PI) / 180;
  const a =
    Math.sin(dA / 2) ** 2 +
    Math.cos((a1 * Math.PI) / 180) *
      Math.cos((a2 * Math.PI) / 180) *
      Math.sin(dO / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ─── Provjeri je li rezultat u bijelo/crnoj listi ─────────────────────────────
function passesFilter(
  tags: Record<string, string>,
  name: string,
  rule: CategoryRule,
): boolean {
  const nameLower = name.toLowerCase();

  // Globalna crna lista
  for (const denied of GLOBAL_NAME_DENYLIST) {
    if (nameLower.includes(denied.toLowerCase())) return false;
  }

  // Kategorizacijska crna lista
  for (const denied of rule.nameDenylist) {
    if (nameLower.includes(denied.toLowerCase())) return false;
  }

  // Provjeri bijelu listu tagova
  for (const wl of rule.whitelist) {
    const tagVal = tags[wl.key];
    if (!tagVal) continue;
    if (wl.values.includes("*") || wl.values.includes(tagVal)) return true;
  }

  return false;
}

// ─── OPG posebna provjera ─────────────────────────────────────────────────────
function isValidOPG(name: string): boolean {
  // OPG mora u imenu sadržavati "OPG" (case insensitive)
  return name.toUpperCase().includes("OPG");
}

// ─── Glavni fetch s Overpass API ──────────────────────────────────────────────
async function fetchFromOverpass(
  latitude: number,
  longitude: number,
  radiusM: number,
  type: string,
): Promise<Place[]> {
  const rule = CATEGORY_RULES[type];
  if (!rule) return [];

  const center = `${latitude},${longitude}`;
  const parts = rule.queries
    .map((q) => `${q}(around:${radiusM},${center});`)
    .join("\n");

  const overpassQuery = `[out:json][timeout:30];
(
${parts}
);
out body;`;

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
  ];

  for (const endpoint of endpoints) {
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 35000);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      if (!res.ok) continue;

      const data = await res.json();
      if (!data.elements?.length) continue;

      const results: Place[] = [];

      for (const el of data.elements) {
        const tags = el.tags || {};
        const name =
          tags.name ||
          tags["name:hr"] ||
          tags["name:en"] ||
          tags["official_name"];
        if (!name) continue;

        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (!lat || !lon) continue;

        const dist = haversineKm(latitude, longitude, lat, lon);
        if (dist > radiusM / 1000) continue;

        // Posebna provjera za OPG
        if (type === "opg" && !isValidOPG(name)) continue;

        // Provjera filtera
        if (!passesFilter(tags, name, rule)) continue;

        results.push({
          id: `${el.type || "node"}_${el.id}`,
          name,
          latitude: lat,
          longitude: lon,
          type: type as Place["type"],
          distance: dist,
          address: tags["addr:street"]
            ? `${tags["addr:street"]} ${tags["addr:housenumber"] || ""}`.trim()
            : undefined,
          rating: tags.stars ? parseFloat(tags.stars) : undefined,
          phone: tags.phone || tags["contact:phone"],
          website: tags.website || tags["contact:website"],
        });
      }

      return results;
    } catch {
      continue;
    }
  }

  return [];
}

// ─── Glavna izvozna funkcija ──────────────────────────────────────────────────
// ─── Glavna izvozna funkcija ──────────────────────────────────────────────────
export const getPlacesInRadius = async (
  latitude: number,
  longitude: number,
  radiusKm: number,
  types?: Place["type"][],
): Promise<Place[]> => {
  if (!types || types.length === 0) return [];

  const radiusM = Math.round(radiusKm * 1000);
  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)},${radiusM},${[...types].sort().join(",")}`;

  const cached = placesCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.places;
  }

  // Dohvati svaki tip paralelno, s Nominatim fallbackom ako < 5 rezultata
  const promises = types.map(async (type): Promise<Place[]> => {
    const overpassResults = await fetchFromOverpass(
      latitude,
      longitude,
      radiusM,
      type,
    );
    if (overpassResults.length < 5) {
      const nominatimResults = await fetchFromNominatim(
        latitude,
        longitude,
        radiusKm,
        type,
      );
      const existingIds = new Set<string>(
        overpassResults.map((p: Place) => p.id),
      );
      const extra = nominatimResults.filter(
        (p: Place) => !existingIds.has(p.id),
      );
      return [...overpassResults, ...extra];
    }
    return overpassResults;
  });

  // ← ovo je bio problem: results nije bio definiran
  const results = await Promise.all(promises);
  const allPlaces = results.flat();

  // Deduplikacija po ID-u
  const seen = new Set<string>();
  const deduped = allPlaces.filter((p: Place) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  // Sortiraj po udaljenosti
  deduped.sort((a: Place, b: Place) => (a.distance ?? 0) - (b.distance ?? 0));

  placesCache.set(cacheKey, { places: deduped, timestamp: Date.now() });
  return deduped;
};

// ─── Nominatim fallback po kategoriji ────────────────────────────────────────
const NOMINATIM_CATEGORY_QUERIES: Record<string, string> = {
  restaurant: "restaurant",
  cafe: "cafe",
  club: "nightclub",
  beach: "beach",
  landmark: "tourist attraction",
  accommodation: "hotel",
  market: "market",
  cinema: "cinema",
  park: "park",
  museum: "museum",
  theater: "theatre",
  mountain: "peak",
  spa: "spa",
  escapeRoom: "escape room",
  paintball: "paintball",
  cave: "cave",
  nationalPark: "national park",
  opg: "OPG",
};

async function fetchFromNominatim(
  latitude: number,
  longitude: number,
  radiusKm: number,
  type: string,
): Promise<Place[]> {
  const query = NOMINATIM_CATEGORY_QUERIES[type];
  if (!query) return [];

  try {
    // Nominatim structured search s bounding boxom
    const delta = radiusKm / 111; // ~1 stupanj = 111 km
    const bbox = `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`;

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=${bbox}&bounded=1&limit=15&addressdetails=1`;

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(url, {
      headers: { "User-Agent": "CroMapApp/1.0" },
      signal: ctrl.signal,
    });
    clearTimeout(tid);

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const results: Place[] = [];
    for (const item of data) {
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      const dist = haversineKm(latitude, longitude, lat, lon);
      if (dist > radiusKm) continue;

      const name = item.name || item.display_name?.split(",")[0];
      if (!name || name.length < 2) continue;

      // Provjeri globalnu crnu listu
      const nameLower = name.toLowerCase();
      const denied = GLOBAL_NAME_DENYLIST.some((d) =>
        nameLower.includes(d.toLowerCase()),
      );
      if (denied) continue;

      results.push({
        id: `nom_${type}_${item.place_id}`,
        name,
        latitude: lat,
        longitude: lon,
        type: type as Place["type"],
        distance: dist,
        address: item.display_name?.split(",").slice(1, 3).join(",").trim(),
      });
    }
    return results;
  } catch {
    return [];
  }
}

export default {
  searchPlaces,
  getPlacesInRadius,
  placeCategories,
  clearPlacesCache,
  geocodeCity,
};
