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
  openNow?: boolean | null;
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

interface CategoryRule {
  queries: string[];
  whitelist: { key: string; values: string[] }[];
  nameDenylist: string[];
}

const CATEGORY_RULES: Record<string, CategoryRule> = {
  restaurant: {
    queries: [
      'node["amenity"="restaurant"]',
      'way["amenity"="restaurant"]',
      'node["amenity"="fast_food"]',
      'way["amenity"="fast_food"]',
      'node["amenity"="food_court"]',
      'way["amenity"="food_court"]',
      // ✅ DODANO: restorani definirani preko cuisine taga
      'node["cuisine"]',
      'way["cuisine"]',
      // ✅ DODANO: restorani definirani preko brand taga
      'node["brand"~"McDonald|KFC|Burger King|Subway|Domino|Pizza Hut",i]',
      'way["brand"~"McDonald|KFC|Burger King|Subway|Domino|Pizza Hut",i]',
      // ✅ DODANO: restorani definirani preko name taga (sadrži "restoran")
      'node["name"~"restoran|pizzeria|grill|ćevabdžinica",i]',
      'way["name"~"restoran|pizzeria|grill|ćevabdžinica",i]',
    ],
    whitelist: [
      { key: "amenity", values: ["restaurant", "fast_food", "food_court"] },
      // ✅ DODANO: dozvoli cuisine i brand tagove
      { key: "cuisine", values: ["*"] },
      { key: "brand", values: ["*"] },
    ],
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
    queries: [
      'node["amenity"="cafe"]',
      'way["amenity"="cafe"]',
      'node["amenity"="coffee_shop"]',
    ],
    // ✅ FIX: maknuto node["amenity"="bar"]["cafe"="yes"] — preširoko, bar tagovi idu u klub
    whitelist: [{ key: "amenity", values: ["cafe", "coffee_shop"] }],
    nameDenylist: [
      "hotel",
      "hostel",
      "apartman",
      "soba",
      "prenočište",
      "bmw",
      "audi",
      "mercedes",
      "volkswagen",
      "vw",
      "opel",
      "ford",
      "toyota",
      "auto",
      "automobil",
      "servis",
      "salon automobila",
      "car",
      "fitness",
      "gym",
      "teretana",
    ],
  },

  club: {
    // ✅ FIX: ISKLJUČIVO nightclub — uklonjen "bar" i "pub" koji su uzrok
    // da kafići, beach barovi, lounge barovi, saloni za pse, tasting shopovi
    // sve završi ovdje. Bar ≠ Nightclub u OSM taksonomiji.
    queries: ['node["amenity"="nightclub"]', 'way["amenity"="nightclub"]'],
    whitelist: [{ key: "amenity", values: ["nightclub"] }],
    nameDenylist: [
      "hotel",
      "hostel",
      "apartman",
      "soba",
      "prenočište",
      "kladionica",
      "kladi",
      "sportska",
      "bet",
      "betting",
      "mozzart",
      "winbet",
      "superbet",
      "lvbet",
      "premiere",
      "germania",
      "admiral",
      "casino",
      "kockarnica",
      "salon",
      "frizersk",
      "kozmetik",
      "beauty",
      "tasting",
      "shop",
      "trgovin",
      "prodavao",
      "restaurant",
      "restoran",
    ],
  },

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

  landmark: {
    queries: [
      'node["historic"]',
      'way["historic"]',
      'relation["historic"]',
      'node["tourism"="attraction"]',
      'way["tourism"="attraction"]',
      'node["tourism"="viewpoint"]',
      'way["tourism"="viewpoint"]',
      'node["amenity"="place_of_worship"]',
      'way["amenity"="place_of_worship"]',
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
          "catacombs",
          "catacomb",
          "bridge",
        ],
      },
      { key: "tourism", values: ["attraction", "viewpoint"] },
      { key: "amenity", values: ["place_of_worship"] },
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
      "hostel street",
      "winterland",
      "wine & walk",
      "wine walk",
      "wine and walk",
      "museum",
      "muzej", // muzeji idu u svoju kategoriju
      "shell museum",
      "water world",
      "sobe",
      "rooms",
      "millennium", // Hotel Millennium
      "arhiv", // državni arhiv nije turistička znamenitost
      "archive",
      "lacković",
      "biljski krokodil",
      "sakuntala", // park s historic tagom — ide u parks
      "centar nekretnine", // singular
      "nekretnine",
      "employment service", // Croatian Employment Service
      "zapošljavanj", // Hrvatski zavod za zapošljavanje
      "zavod za zaposl", // kratica/alternativa
      "hzz",
    ],
  },

  opg: {
    queries: [
      'node["shop"="farm"]',
      'way["shop"="farm"]',
      'node["produce"]',
      'way["produce"]',
      // ✅ FIX: dodano name filter direktno u query ne pomaže u Overpassu,
      // ali dodajemo farmyard da ne propustimo OPG-ove koji su way
      'node["landuse"="farmyard"]["name"~"OPG",i]',
      'way["landuse"="farmyard"]["name"~"OPG",i]',
    ],
    whitelist: [
      { key: "shop", values: ["farm"] },
      { key: "landuse", values: ["farmyard", "farm"] },
      { key: "produce", values: ["*"] },
      { key: "name", values: ["*"] },
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

  accommodation: {
    queries: [
      'node["tourism"="hotel"]',
      'way["tourism"="hotel"]',
      'node["tourism"="hostel"]',
      'way["tourism"="hostel"]',
      'node["tourism"="apartment"]',
      'way["tourism"="apartment"]',
      'node["tourism"="guest_house"]',
      'way["tourism"="guest_house"]',
      'node["tourism"="motel"]',
      'way["tourism"="motel"]',
      'node["tourism"="bed_and_breakfast"]',
      'way["tourism"="bed_and_breakfast"]',
      'node["tourism"="camp_site"]',
      'way["tourism"="camp_site"]',
      // ✅ DODANO: sobe, rooms, accommodation
      'node["name"~"sobe|rooms|apartments|accommodation",i]',
      'way["name"~"sobe|rooms|apartments|accommodation",i]',
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
          "camp_site",
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
      "salon",
      "ambulanta",
      "ljekarnica",
      "kazalište",
      "theatre",
      "kino",
      "restoran",
      "bischof",
      "restoran",
      "restaurant",
      "bistro",
      "caffe",
      "kafić",
      "zrinjevac",
      "perla",
    ],
  },
  market: {
    // ✅ FIX: uklonjeni supermarket i convenience — korisnik NE želi
    // prikazivati trgovine, samo tržnice (marketplace)
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
      "šetalište",
      "setaliste",
      "ntl",
      "feđika",
      "fedika",
      "park",
      "ulica",
      "trg",
    ],
  },

  paintball: {
    queries: [
      'node["sport"="paintball"]',
      'way["sport"="paintball"]',
      'node["leisure"="sports_centre"]["sport"="paintball"]',
      'way["leisure"="sports_centre"]["sport"="paintball"]',
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
    nameDenylist: [
      "hotel",
      "hostel",
      "apartman",
      "it",
      "nekretnin",
      "grad ",
      "općina",
      "municipality",
      "dvorac",
      "crkva",
      "muzej",
      "knjižnica",
      "škola",
      "bolnica",
      "zgrada",
      "palace",
      "palača",
      "tvrđava",
      "dom kulture",
      "kulturni centar",
      "kulturni dom",
    ],
  },

  park: {
    queries: [
      'node["leisure"="park"]',
      'way["leisure"="park"]',
      'relation["leisure"="park"]',
    ],
    whitelist: [{ key: "leisure", values: ["park", "garden"] }],
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
      "fićo", // Red fićo (restoran/bar, ne park)
      "red fić",
      "podgorje",
      "suvara",
      "kraševo",
      "krasevo",
      "bikana",
      "čimen",
      "cimen",
      "južni blok",
      "juzni blok",
      "removac",
      "removač",
      // Generički uzorci za naselja i blokove
      "blok",
      "naselje",
      "zaselak",
      "zaselje",
      "ulica",
      "trg",
      "cesta",
      " sa morem",
      "sa morem",
      // Rubna zona / predjel bez prave parkovne infrastrukture
      "predio",
      "predjel",
      "zona",
      "četvrt",
      "cetvrt",
      "kvart",
      "kvart",
      "perivoj", // ← NOVO: Perivoj bana Šokčevića, Perivoj hrvatskih velikana
      "monument", // ← NOVO: Monument to Miroslav Krleža (ima leisure=park tag u OSM-u)
      "miroslav", // ← NOVO: specifično za ovaj monument
      "park sakuntala",
    ],
  },

  escapeRoom: {
    queries: [
      'node["leisure"="escape_game"]',
      'way["leisure"="escape_game"]',
      'node["amenity"="escape_game"]',
      'way["amenity"="escape_game"]',
    ],
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
    ],
  },

  museum: {
    queries: ['node["tourism"="museum"]', 'way["tourism"="museum"]'],
    whitelist: [{ key: "tourism", values: ["museum"] }],
    // ✅ FIX: dodani "most", "bridge", "catacomb", "katakomb" — ne smiju biti muzeji
    nameDenylist: [
      "most",
      "bridge",
      "catacomb",
      "katakomb",
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
      "bridge bench",
      "bench",
      "war scarred",
      "scarred building",
      "building",
      "ruin",
      "shell museum",
      "water world",
      "školjaka",
      "skoljaka",
      "catacomb", // ← vraćeno: blokira OSM katakombe u muzejima
      "catacombs",
      "katakomba",
    ],
  },

  theater: {
    queries: [
      'node["amenity"="theatre"]',
      'way["amenity"="theatre"]',
      'relation["amenity"="theatre"]',
    ],

    whitelist: [{ key: "amenity", values: ["theatre"] }],

    nameDenylist: [
      "hotel",
      "hostel",
      "apartman",
      "apartment",
      "apartments",
      "soba",
      "sobe",
      "rooms",
      "room",
      "guest",
      "guesthouse",
      "guest house",
      "smještaj",
      "accommodation",
      "lodging",
      "villa",
      "vila",
      "resort",
      "motel",
      "inn",
      "pansion",
      "bed",
      "breakfast",
      "b&b",
      "studio",
      "suite",
      "kuća za odmor",
      "odmaralište",
      "camp",
      "glamping",
    ],
  },

  mountain: {
    queries: [
      'node["natural"="peak"]',
      'node["natural"="hill"]',
      'way["natural"="peak"]',
    ],
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
    ],
  },

  nationalPark: {
    queries: [
      'relation["boundary"="national_park"]',
      'relation["boundary"="protected_area"]["protect_class"="2"]',
      'way["boundary"="national_park"]',
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
    ],
  },

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
    ],
  },

  spa: {
    queries: [
      'node["amenity"="spa"]',
      'way["amenity"="spa"]',
      'node["leisure"="spa"]',
      'way["leisure"="spa"]',
      'node["leisure"="water_park"]',
      'way["leisure"="water_park"]',
      'node["natural"="hot_spring"]',
    ],
    whitelist: [
      { key: "amenity", values: ["spa"] },
      { key: "leisure", values: ["spa", "water_park"] },
      { key: "natural", values: ["hot_spring"] },
    ],
    // ✅ FIX: proširena denylist — ambulanta, beauty salon, fitness, centar kulture tijela ne smiju biti toplice
    nameDenylist: [
      // Medicinsko
      "ambulanta",
      "liječnik",
      "doktor",
      "medicina",
      "medical",
      "obiteljske",
      "dežurna",
      "fizioterapija",
      "fizioterapi",
      "physio",
      "rehabilitaci",
      // Kozmetika — i s dijakriticima
      "beauty",
      "kozmetik",
      "kozmetičk",
      "estetika",
      "estetica",
      "estetska",
      "salon",
      "nail",
      "manikur",
      "pedikur",
      // Fitness
      "fitness",
      "fit",
      "gym",
      "teretana",
      "crossfit",
      "osobni trening",
      "treninzi",
      // Tijelo/njega
      "njegu",
      "kulture tijela",
      "centar kulture",
      "sport i njegu",
      "tensegrity",
      "wellar",
      "body service",
      "body care",
      // Studio/smještaj
      "studio",
      "apartman",
      "hotel",
      "hostel",
      // Poslovno
      "obrt",
      "d.o.o",
      "nekretnin",
      "ljekarnica",
      "apoteka",
      "wellness centar",
    ],
  },
};

// ─── Globalna crna lista naziva koji se NIKADA ne smiju prikazati ─────────────
const GLOBAL_NAME_DENYLIST = [
  "mono d.o.o",
  "centar nekretnina",
  "centar nekretnine",
  "nekretnin",
  "it park",
  "nekretnin",
  "kladionica",
  "sportska kladionica",
  "mozzart",
  "winbet",
  "superbet",
  "lvbet",
  "admiral casino",
  "kockarnica",
  // ✅ FIX: dodano — saloni za pse i slični obrti ne smiju se nigdje prikazati
  "salon za pse",
  "dog salon",
  "frizerski salon",
  "uljepšavanje",
  // ✅ FIX: nekretnine i IT firme
  "agencija za nekretnine",
  "fitness centar",
  "beauty salon",
  "centar ljepote",
  "perla",
  "guest house",
  "guesthouse",
  "apartments",
  "rooms",
  "accommodation",
  "lodging",
  "salon za pse",
  "dog salon",
  "pet salon",
  "grooming salon",
  "njega pasa",
  "šišanje pasa",
  "uređivanje pasa",
  "kućni ljubimac",
  "ljubimac",
  "automat club",
  "automat",
  "gaming club",
  "slot club",
  "tombola",
  "frizerski salon",
  "hair salon",
  "barber shop",
  "brijačnica",
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

  const ACCOMMODATION_TAGS = [
    "hotel",
    "hostel",
    "apartment",
    "guest_house",
    "motel",
    "bed_and_breakfast",
    "camp_site",
  ];

  if (
    ACCOMMODATION_TAGS.includes(tags.tourism) ||
    ACCOMMODATION_TAGS.includes(tags.accommodation) ||
    ACCOMMODATION_TAGS.includes(tags.building)
  ) {
    return false;
  }

  // ✅ NOVO: Ako objekt ima tourism tag smještaja → nikad nije kazalište/park/muzej
  const ACCOMMODATION_TOURISM_TAGS = [
    "hotel",
    "hostel",
    "apartment",
    "guest_house",
    "motel",
    "bed_and_breakfast",
    "camp_site",
  ];
  if (
    tags.tourism &&
    ACCOMMODATION_TOURISM_TAGS.includes(tags.tourism) &&
    // Iznimka: accommodation kategorija smije imati ove tagove
    !rule.whitelist.some(
      (wl) =>
        wl.key === "tourism" &&
        ACCOMMODATION_TOURISM_TAGS.some((t) => wl.values.includes(t)),
    )
  ) {
    return false;
  }

  const LANDMARK_HISTORIC_VALUES = [
    "castle",
    "monument",
    "memorial",
    "ruins",
    "archaeological_site",
    "building",
    "fort",
    "church",
    "city_gate",
    "catacombs",
    "catacomb",
    "bridge",
  ];
  if (
    tags.historic &&
    LANDMARK_HISTORIC_VALUES.includes(tags.historic) &&
    !rule.whitelist.some((wl) => wl.key === "historic")
  ) {
    return false;
  }

  // ✅ NOVO: Za theater, dodatno provjeri da nije smještaj PO IMENU
  if (rule.whitelist.some((wl) => wl.values.includes("theatre"))) {
    // Ključne riječi koje označavaju smještaj (čak i ako ima amenity=theatre)
    const accommodationNames = [
      "hotel",
      "hostel",
      "apartman",
      "soba",
      "prenočište",
      "guest house",
      "guesthouse",
      "apartment",
      "rooms",
      "smještaj",
      "accommodation",
      "lodging",
      "bed & breakfast",
      "b&b",
      "inn",
      "villa",
      "resort",
      "perla inn",
      "pansion",
      "motel",
      "studio",
      "room",
      "vila",
      "kuća za odmor",
      "odmaralište",
      "aparthotel",
      "apartments",
    ];

    for (const accName of accommodationNames) {
      if (nameLower.includes(accName)) {
        return false;
      }
    }

    // Također provjeri tagove za smještaj
    if (
      tags.tourism === "hotel" ||
      tags.tourism === "hostel" ||
      tags.tourism === "apartment" ||
      tags.tourism === "guest_house"
    ) {
      return false;
    }
    if (tags.amenity === "hotel" || tags.amenity === "hostel") {
      return false;
    }
  }

  // ✅ NOVO: Ako je objekt s amenity=theatre, ali ima i tourism tag za smještaj → odbij
  if (tags.amenity === "theatre") {
    const tourismTags = [
      "hotel",
      "hostel",
      "apartment",
      "guest_house",
      "motel",
      "bed_and_breakfast",
    ];
    if (tags.tourism && tourismTags.includes(tags.tourism)) {
      return false;
    }
  }

  if (Object.keys(tags).length === 0) return false;

  for (const wl of rule.whitelist) {
    const tagVal = tags[wl.key];
    if (!tagVal) continue;
    if (wl.values.includes("*") || wl.values.includes(tagVal)) return true;
  }

  return false;
}
// ─── OPG posebna provjera ─────────────────────────────────────────────────────
function isValidOPG(tags: Record<string, string>, name: string): boolean {
  const combined = [
    name,
    tags.operator || "",
    tags.brand || "",
    tags["official_name"] || "",
    tags.description || "",
  ]
    .join(" ")
    .toUpperCase();
  return (
    combined.includes("OPG") ||
    tags.shop === "farm" || // ako je shop=farm, to je OPG
    tags.produce != null // ako ima produce tag, to je OPG
  );
}

// ─── Deduplikacija po imenu + blizini (za duple prikaze poput Zoo Hotel) ──────
// ✅ FIX: ID-based dedup nije dovoljan jer Overpass i Nominatim daju različite ID-eve
// za isti objekt. Dodajemo provjeru: isti naziv + udaljenost < 100m = duplikat.
function deduplicatePlaces(places: Place[]): Place[] {
  const result: Place[] = [];
  for (const place of places) {
    const isDuplicate = result.some((existing) => {
      const sameName =
        existing.name.toLowerCase().trim() === place.name.toLowerCase().trim();
      const closeEnough =
        haversineKm(
          existing.latitude,
          existing.longitude,
          place.latitude,
          place.longitude,
        ) < 0.1; // 100 metara
      return sameName && closeEnough;
    });
    if (!isDuplicate) result.push(place);
  }
  return result;
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

  // ✅ FIX: dodan "out center;" — bez njega `way` elementi nemaju koordinate
  // (el.center je undefined), pa su svi way objekti (McDonald's kao way,
  // OPG kao way, znamenitosti kao way) bili tiho filtrirani zbog !lat || !lon
  const overpassQuery = `[out:json][timeout:30];
(
${parts}
);
out body center;`;

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

        // ✅ FIX: el.center sada postoji za way/relation jer koristimo "out body center;"
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (!lat || !lon) continue;

        const dist = haversineKm(latitude, longitude, lat, lon);
        if (dist > radiusM / 1000) continue;

        if (type === "opg") {
          if (!isValidOPG(tags, name)) continue;
          const nameLower = name.toLowerCase();
          const globalDenied = GLOBAL_NAME_DENYLIST.some((d) =>
            nameLower.includes(d.toLowerCase()),
          );
          if (globalDenied) continue;
          const catDenied = rule.nameDenylist.some((d) =>
            nameLower.includes(d.toLowerCase()),
          );
          if (catDenied) continue;
        } else {
          if (!passesFilter(tags, name, rule)) continue;
        }

        // Posebna provjera za theater - odbij sve što liči na smještaj
        // Theater: odbij smještaj, BEZ name whitelist — amenity=theatre je dovoljan
        if (type === "theater") {
          const nameLower = name.toLowerCase();
          const accommodationIndicators = [
            "hotel",
            "hostel",
            "apartman",
            "apartment",
            "soba",
            "sobe",
            "rooms",
            "room",
            "prenočište",
            "prenoćište",
            "guest",
            "villa",
            "vila",
            "resort",
            "odmaralište",
            "pansion",
            "motel",
            "inn",
            "b&b",
            "bed",
            "breakfast",
            "smještaj",
            "accommodation",
            "lodging",
            "studio",
            "suite",
            "camp",
            "glamping",
            "nekretnin",
          ];
          if (accommodationIndicators.some((ind) => nameLower.includes(ind))) {
            continue;
          }
        }

        results.push({
          id: `osm_${el.type}_${el.id}`,
          name,
          latitude: lat,
          longitude: lon,
          type: type as Place["type"],
          distance: dist,
          address:
            [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"]]
              .filter(Boolean)
              .join(" ") || undefined,
          phone: tags.phone || tags["contact:phone"] || undefined,
          website: tags.website || tags["contact:website"] || undefined,
          openingHours: tags.opening_hours || undefined,
          rating: tags.stars ? parseFloat(tags.stars) : undefined,
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

  // Blok smještajnih ključnih riječi za theater (koristi se na dva mjesta)
  const THEATER_BLOCK = [
    "hotel",
    "hostel",
    "guest",
    "guesthouse",
    "guest house",
    "apartman",
    "apartment",
    "apartments",
    "rooms",
    "room",
    "soba",
    "sobe",
    "villa",
    "vila",
    "resort",
    "inn",
    "motel",
    "lodging",
    "accommodation",
    "smještaj",
    "bed",
    "breakfast",
    "b&b",
    "suite",
    "studio",
    "camp",
    "glamping",
    "pansion",
    "pension",
    "nekretnin",
  ];

  const promises = types.map(async (type): Promise<Place[]> => {
    const overpassResults = await fetchFromOverpass(
      latitude,
      longitude,
      radiusM,
      type,
    );

    if (type === "theater") {
      // OSM amenity=theatre je dovoljan — ne trebamo name whitelist.
      // Blokiramo samo očiti smještaj.
      const filtered = overpassResults.filter((p) => {
        const n = p.name.toLowerCase().trim();
        return !THEATER_BLOCK.some((bad) => n.includes(bad));
      });

      // Nominatim fallback samo ako OSM nema dovoljno, ali s name filterom
      // jer Nominatim vraća gradove/regije za query "theatre"
      if (filtered.length < 2) {
        const nominatimResults = await fetchFromNominatim(
          latitude,
          longitude,
          radiusKm,
          type,
        );
        const validNominatim = nominatimResults.filter((p) => {
          const n = p.name.toLowerCase().trim();
          // WHITELIST: samo stvarna kazališta po imenu
          const isRealTheater =
            n.includes("kazalište") ||
            n.includes("kazaliste") ||
            n.includes("teatar") ||
            n.includes("theatre") ||
            n.includes("theater") ||
            n.startsWith("hnk") ||
            n.includes("dječje") ||
            n.includes("narodno");
          if (!isRealTheater) return false;
          // BLACKLIST: ukloni smještaj
          return !THEATER_BLOCK.some((bad) => n.includes(bad));
        });
        const existingIds = new Set(filtered.map((p) => p.id));
        return [
          ...filtered,
          ...validNominatim.filter((p) => !existingIds.has(p.id)),
        ];
      }
      return filtered;
    }

    // Sve ostale kategorije — standardni Nominatim fallback
    if (overpassResults.length < 3) {
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

  const results = await Promise.all(promises);
  let allPlaces = results.flat();

  // Post-filter za theater — ukloni smještaj koji je možda ušao kroz Google
  // (street keyword provjera uklonjena — blokirala je legitimna kazališta)
  if (types.includes("theater")) {
    allPlaces = allPlaces.filter((place) => {
      if (place.type !== "theater") return true;
      const nameLower = place.name.toLowerCase();
      return !THEATER_BLOCK.some((kw) => nameLower.includes(kw));
    });
  }

  const deduped = deduplicatePlaces(allPlaces);
  deduped.sort((a: Place, b: Place) => (a.distance ?? 0) - (b.distance ?? 0));

  placesCache.set(cacheKey, { places: deduped, timestamp: Date.now() });
  return deduped;
};

// ─── Nominatim fallback po kategoriji ────────────────────────────────────────
const NOMINATIM_CATEGORY_QUERIES: Record<string, string> = {
  restaurant: "restaurant OR fast food OR pizzeria OR grill",
  cafe: "cafe",
  // ✅ FIX: club fallback samo za nightclub, ne "bar"
  club: "nightclub",
  beach: "beach",
  landmark: "castle OR church OR monument OR historic",
  accommodation: "hotel",
  // ✅ FIX: market fallback samo za tržnicu, ne "market" (preširoko)
  market: "marketplace",
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
  opg: "farm OR OPG",
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
    const delta = radiusKm / 111;
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

    const rule = CATEGORY_RULES[type];
    const results: Place[] = [];

    for (const item of data) {
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      const dist = haversineKm(latitude, longitude, lat, lon);
      if (dist > radiusKm) continue;

      const name = item.name || item.display_name?.split(",")[0];
      if (!name || name.length < 2) continue;

      const nameLower = name.toLowerCase();

      // Globalna crna lista
      const globalDenied = GLOBAL_NAME_DENYLIST.some((d) =>
        nameLower.includes(d.toLowerCase()),
      );
      if (globalDenied) continue;

      // ✅ FIX: i u Nominatim fallbacku primjeni kategorizacijsku crnu listu
      if (rule) {
        const categoryDenied = rule.nameDenylist.some((d) =>
          nameLower.includes(d.toLowerCase()),
        );
        if (categoryDenied) continue;
      }

      if (type === "park") {
        const isRealPark =
          nameLower.includes("park") ||
          nameLower.includes("garden") ||
          nameLower.includes("šetalište") ||
          nameLower.includes("setaliste");
        if (!isRealPark) continue;
      }

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
