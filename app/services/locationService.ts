// app/services/locationService.ts
import { getPlacesFromGoogle } from "./googlePlacesService";

// Tipovi za lokacije
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
    | "farm"
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

// Kategorije s ikonama i bojama
export const placeCategories = {
  restaurant: {
    name: "Restoran",
    icon: "🍽️",
    color: "#FF6B6B",
    marker: "restaurant",
    osmTag: "amenity=restaurant",
  },
  cafe: {
    name: "Kafić",
    icon: "☕",
    color: "#4ECDC4",
    marker: "cafe",
    osmTag: "amenity=cafe",
  },
  club: {
    name: "Noćni klub",
    icon: "🎵",
    color: "#9B59B6",
    marker: "club",
    osmTag: "amenity=nightclub",
  },
  beach: {
    name: "Plaža",
    icon: "🏖️",
    color: "#3498DB",
    marker: "beach",
    osmTag: "natural=beach",
  },
  landmark: {
    name: "Znamenitost",
    icon: "🏰",
    color: "#F1C40F",
    marker: "landmark",
    osmTag: "historic=*",
  },
  farm: {
    name: "OPG",
    icon: "🌾",
    color: "#2ECC71",
    marker: "farm",
    osmTag: "shop=farm",
  },
  paintball: {
    name: "Paintball",
    icon: "🎯",
    color: "#E67E22",
    marker: "paintball",
    osmTag: "sport=paintball",
  },
  cinema: {
    name: "Kino",
    icon: "🎬",
    color: "#E74C3C",
    marker: "cinema",
    osmTag: "amenity=cinema",
  },
  park: {
    name: "Park",
    icon: "🌳",
    color: "#27AE60",
    marker: "park",
    osmTag: "leisure=park",
  },
  escapeRoom: {
    name: "Escape Room",
    icon: "🔐",
    color: "#F39C12",
    marker: "escape_room",
    osmTag: "leisure=escape_game",
  },
  museum: {
    name: "Muzej",
    icon: "🏛️",
    color: "#8E44AD",
    marker: "museum",
    osmTag: "tourism=museum",
  },
  theater: {
    name: "Kazalište",
    icon: "🎭",
    color: "#D35400",
    marker: "theatre",
    osmTag: "amenity=theatre",
  },
  mountain: {
    name: "Planina",
    icon: "⛰️",
    color: "#7F8C8D",
    marker: "mountain",
    osmTag: "natural=peak",
  },
  nationalPark: {
    name: "Nacionalni park",
    icon: "🏞️",
    color: "#2ECC71",
    marker: "national_park",
    osmTag: "leisure=nature_reserve",
  },
  cave: {
    name: "Špilja",
    icon: "🕳️",
    color: "#95A5A6",
    marker: "cave",
    osmTag: "natural=cave_entrance",
  },
  spa: {
    name: "Toplice",
    icon: "💧",
    color: "#1ABC9C",
    marker: "spa",
    osmTag: "amenity=spa",
  },
};

// 🔥 CACHE ZA MJESTA
let placesCache: Map<string, { places: Place[]; timestamp: number }> =
  new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minuta

let googleCache: Map<string, { places: Place[]; timestamp: number }> =
  new Map();
const GOOGLE_CACHE_DURATION = 10 * 60 * 1000;

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export const clearPlacesCache = () => {
  placesCache.clear();
  googleCache.clear();
  console.log("🗑️ Cache cleared");
};

// Pretraga mjesta
export const searchPlaces = async (
  query: string,
  lat?: number,
  lon?: number,
): Promise<Place[]> => {
  if (!query.trim()) return [];

  try {
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query,
    )}&limit=10&addressdetails=1`;

    if (lat && lon) {
      url += `&lat=${lat}&lon=${lon}&radius=5000`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "CroMapApp/1.0",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("JSON parse error");
      return [];
    }

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: any) => ({
      id: item.place_id?.toString() || Date.now().toString(),
      name: item.display_name?.split(",")[0] || "Nepoznato mjesto",
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      type: categorizePlaceByTags(item),
      address: item.display_name,
    }));
  } catch (error) {
    console.error("Error searching places:", error);
    return [];
  }
};

// Kategorizacija prema OSM tagovima
const categorizePlaceByTags = (item: any): Place["type"] => {
  const type = item.type?.toLowerCase() || "";
  const class_ = item.class?.toLowerCase() || "";
  const tags = item.tags || {};

  if (type === "restaurant" || class_ === "restaurant") return "restaurant";
  if (type === "cafe" || class_ === "cafe") return "cafe";
  if (type === "nightclub" || type === "bar" || class_ === "nightclub")
    return "club";
  if (type === "beach" || class_ === "beach") return "beach";
  if (type === "farm" || class_ === "farm") return "farm";
  if (type === "cinema" || class_ === "cinema") return "cinema";
  if (type === "park" || class_ === "park") return "park";
  if (type === "escape_room" || class_ === "escape_room") return "escapeRoom";
  if (type === "theatre" || class_ === "theatre") return "theater";
  if (type === "mountain" || class_ === "mountain" || type === "peak")
    return "mountain";
  if (type === "national_park" || class_ === "national_park")
    return "nationalPark";
  if (type === "cave" || class_ === "cave") return "cave";
  if (type === "spa" || class_ === "spa") return "spa";
  if (type === "paintball" || class_ === "paintball") return "paintball";

  if (type === "museum" || class_ === "museum" || tags.tourism === "museum") {
    return "museum";
  }

  if (
    type === "historic" ||
    class_ === "historic" ||
    tags.historic ||
    (type === "tourism" && tags.tourism !== "museum") ||
    (class_ === "attraction" && tags.tourism !== "museum") ||
    tags.heritage ||
    tags.castle ||
    tags.ruins ||
    tags.memorial ||
    tags.monument
  ) {
    return "landmark";
  }

  return "landmark";
};

// 🔥 GLAVNA FUNKCIJA - OPTIMIZIRANA ZA VELIKE RADIJUSE
export const getPlacesInRadius = async (
  latitude: number,
  longitude: number,
  radiusKm: number,
  types?: Place["type"][],
): Promise<Place[]> => {
  if (!types || types.length === 0) return [];

  console.log(`🎯 getPlacesInRadius called with radius: ${radiusKm}km`);

  // 🔥 ZA VELIKE RADIJUSE (>50km) PRESKOČI GOOGLE (ima limit 50km)
  if (radiusKm > 50) {
    console.log(
      `⚠️ Radius ${radiusKm}km > 50km, skipping Google, using OSM directly`,
    );
    return fetchFromOpenStreetMap(latitude, longitude, radiusKm, types);
  }

  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)},${radiusKm},${types.sort().join(",")}`;
  const cached = placesCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`📦 Using cached places for ${cacheKey}`);
    return cached.places;
  }

  let allPlaces: Place[] = [];

  const googleCacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)},${radiusKm},${types.sort().join(",")}`;
  const googleCached = googleCache.get(googleCacheKey);

  if (
    googleCached &&
    Date.now() - googleCached.timestamp < GOOGLE_CACHE_DURATION
  ) {
    console.log(`📦 Using cached Google Places`);
    allPlaces = googleCached.places;
  } else {
    try {
      const googlePlaces = await getPlacesFromGoogle(
        latitude,
        longitude,
        radiusKm,
        types,
      );
      if (googlePlaces.length > 0) {
        console.log(`✅ Found ${googlePlaces.length} places from Google`);
        allPlaces = googlePlaces;
        googleCache.set(googleCacheKey, {
          places: googlePlaces,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.log("❌ Google failed:", error);
    }
  }

  if (allPlaces.length === 0) {
    allPlaces = await fetchFromOpenStreetMap(
      latitude,
      longitude,
      radiusKm,
      types,
    );
  }

  if (allPlaces.length > 0) {
    placesCache.set(cacheKey, { places: allPlaces, timestamp: Date.now() });
  }

  return allPlaces;
};

// 🔥 OPTIMIZIRANA OSM FUNKCIJA ZA VELIKE RADIJUSE
const fetchFromOpenStreetMap = async (
  latitude: number,
  longitude: number,
  radiusKm: number,
  types: Place["type"][],
): Promise<Place[]> => {
  console.log(`🌍 OSM fetch started for radius: ${radiusKm}km`);

  const typeToTag: Record<string, string> = {
    restaurant: "amenity=restaurant",
    cafe: "amenity=cafe",
    club: "amenity=nightclub",
    beach: "natural=beach",
    landmark: "historic=*",
    farm: "shop=farm",
    cinema: "amenity=cinema",
    park: "leisure=park",
    museum: "tourism=museum",
    theater: "amenity=theatre",
    mountain: "natural=peak",
    nationalPark: "leisure=nature_reserve",
    cave: "natural=cave_entrance",
    spa: "amenity=spa",
    paintball: "sport=paintball",
  };

  const groupSize = radiusKm > 100 ? 4 : radiusKm > 50 ? 3 : 2;
  const typeGroups = chunkArray(types, groupSize);
  let allPlaces: Place[] = [];

  for (const group of typeGroups) {
    const tags: string[] = [];
    group.forEach((type) => {
      const tag = typeToTag[type];
      if (tag && !tags.includes(tag)) tags.push(tag);
    });
    if (tags.length === 0) continue;

    console.log(
      `🌍 Fetching OSM for: ${tags.join(", ")} (group size: ${groupSize})`,
    );

    const offset = radiusKm / 85;
    const minLat = latitude - offset;
    const maxLat = latitude + offset;
    const minLon = longitude - offset;
    const maxLon = longitude + offset;

    const queries = tags.map((tag) => {
      const [key, value] = tag.split("=");
      if (value === "*") {
        return `node["${key}"](${minLat},${minLon},${maxLat},${maxLon});`;
      } else {
        return `node["${key}"="${value}"](${minLat},${minLon},${maxLat},${maxLon});`;
      }
    });

    const timeoutSec = radiusKm > 100 ? 60 : radiusKm > 50 ? 50 : 35;
    const overpassQuery = `[out:json][timeout:${timeoutSec}];(${queries.join("")});out body;`;
    console.log(`📤 Query timeout: ${timeoutSec}s`);

    const endpoints = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.openstreetmap.fr/api/interpreter",
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`🌍 Trying: ${endpoint}`);
        const controller = new AbortController();
        const timeoutMs = timeoutSec * 1000 + 5000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(overpassQuery)}`,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.log(`⚠️ ${endpoint} returned ${response.status}`);
          continue;
        }

        const data = await response.json();
        if (!data.elements?.length) {
          console.log(`⚠️ No elements from ${endpoint}`);
          continue;
        }

        console.log(`✅ Found ${data.elements.length} raw elements`);

        const places = data.elements
          .map((element: any) => {
            const tags = element.tags || {};
            const lat = element.lat;
            const lon = element.lon;
            if (!lat || !lon) return null;

            const distance = calculateDistance(latitude, longitude, lat, lon);
            if (distance > radiusKm) return null;

            let placeType: Place["type"] = "landmark";
            if (tags.amenity === "restaurant") placeType = "restaurant";
            else if (tags.amenity === "cafe") placeType = "cafe";
            else if (tags.amenity === "nightclub") placeType = "club";
            else if (tags.natural === "beach") placeType = "beach";
            else if (tags.shop === "farm") placeType = "farm";
            else if (tags.amenity === "cinema") placeType = "cinema";
            else if (tags.leisure === "park") placeType = "park";
            else if (tags.leisure === "escape_game") placeType = "escapeRoom";
            else if (tags.tourism === "museum") placeType = "museum";
            else if (tags.amenity === "theatre") placeType = "theater";
            else if (tags.natural === "peak") placeType = "mountain";
            else if (tags.leisure === "nature_reserve")
              placeType = "nationalPark";
            else if (tags.natural === "cave_entrance") placeType = "cave";
            else if (tags.amenity === "spa") placeType = "spa";
            else if (tags.sport === "paintball") placeType = "paintball";
            else if (tags.historic || tags.tourism === "attraction")
              placeType = "landmark";
            else return null;

            if (!group.includes(placeType)) return null;

            const name = tags.name || tags["name:hr"] || tags["name:en"];
            if (!name) return null;

            return {
              id: `${element.type}_${element.id}`,
              name: name,
              latitude: lat,
              longitude: lon,
              type: placeType,
              distance: distance,
            } as Place;
          })
          .filter((p: Place | null): p is Place => p !== null);

        if (places.length > 0) {
          allPlaces.push(...places);
          console.log(`✅ Added ${places.length} places from ${endpoint}`);
          break;
        }
      } catch (error) {
        console.log(`❌ Error with ${endpoint}:`, error);
      }
    }
  }

  console.log(`🌍 Total OSM places found: ${allPlaces.length}`);
  return allPlaces;
};

// Izračun udaljenosti (Haversine formula)
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Default export za Expo Router
export default {
  searchPlaces,
  getPlacesInRadius,
  placeCategories,
  clearPlacesCache,
};
