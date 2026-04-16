// app/services/locationService.ts
import { getPlacesFromGoogle } from "./googlePlacesService";

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
    | "paintball"
    | "cinema"
    | "park"
    | "escapeRoom"
    | "museum"
    | "theater"
    | "mountain"
    | "nationalPark"
    | "cave"
    | "spa"
    | "accommodation"
    | "market";
  rating?: number;
  address?: string;
  description?: string;
  distance?: number;
  phone?: string;
  website?: string;
  openingHours?: string;
}

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
  opg: {
    name: "OPG",
    icon: "🌾",
    color: "#27AE60",
    marker: "opg",
    osmTag: "shop=farm",
  },
  accommodation: {
    name: "Smještaji",
    icon: "🏨",
    color: "#2980B9",
    marker: "accommodation",
    osmTag: "tourism=hotel",
  },
  market: {
    name: "Tržnica",
    icon: "🛒",
    color: "#D4AC0D",
    marker: "market",
    osmTag: "amenity=marketplace",
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

let placesCache: Map<string, { places: Place[]; timestamp: number }> =
  new Map();
const CACHE_DURATION = 5 * 60 * 1000;

let googleCache: Map<string, { places: Place[]; timestamp: number }> =
  new Map();
const GOOGLE_CACHE_DURATION = 10 * 60 * 1000;

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size)
    chunks.push(array.slice(i, i + size));
  return chunks;
}

export const clearPlacesCache = () => {
  placesCache.clear();
  googleCache.clear();
};

export const searchPlaces = async (
  query: string,
  lat?: number,
  lon?: number,
): Promise<Place[]> => {
  if (!query.trim()) return [];
  try {
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1`;
    if (lat && lon) url += `&lat=${lat}&lon=${lon}&radius=5000`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      headers: { "User-Agent": "CroMapApp/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = JSON.parse(await response.text());
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => ({
      id: item.place_id?.toString() || Date.now().toString(),
      name: item.display_name?.split(",")[0] || "Nepoznato mjesto",
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      type: categorizePlaceByTags(item),
      address: item.display_name,
    }));
  } catch {
    return [];
  }
};

// Geocode a city name to coordinates
export const geocodeCity = async (
  cityName: string,
): Promise<{
  latitude: number;
  longitude: number;
  displayName: string;
} | null> => {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&limit=1&addressdetails=1`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      headers: { "User-Agent": "CroMapApp/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const data = JSON.parse(await response.text());
    if (!Array.isArray(data) || data.length === 0) return null;
    const item = data[0];
    return {
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      displayName:
        item.display_name?.split(",").slice(0, 2).join(", ") || cityName,
    };
  } catch {
    return null;
  }
};

const categorizePlaceByTags = (item: any): Place["type"] => {
  const type = item.type?.toLowerCase() || "";
  const class_ = item.class?.toLowerCase() || "";
  if (type === "restaurant" || class_ === "restaurant") return "restaurant";
  if (type === "cafe" || class_ === "cafe") return "cafe";
  if (type === "nightclub" || type === "bar") return "club";
  if (type === "beach") return "beach";
  if (type === "farm" || class_ === "farm") return "opg";
  if (type === "hotel" || type === "hostel" || type === "motel")
    return "accommodation";
  if (type === "marketplace" || class_ === "marketplace") return "market";
  if (type === "cinema") return "cinema";
  if (type === "park") return "park";
  if (type === "theatre") return "theater";
  if (type === "mountain" || type === "peak") return "mountain";
  if (type === "national_park") return "nationalPark";
  if (type === "cave") return "cave";
  if (type === "spa") return "spa";
  if (type === "museum") return "museum";
  return "landmark";
};

export const getPlacesInRadius = async (
  latitude: number,
  longitude: number,
  radiusKm: number,
  types?: Place["type"][],
): Promise<Place[]> => {
  if (!types || types.length === 0) return [];

  if (radiusKm > 50) {
    return fetchFromOpenStreetMap(latitude, longitude, radiusKm, types);
  }

  const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)},${radiusKm},${types.sort().join(",")}`;
  const cached = placesCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION)
    return cached.places;

  let allPlaces: Place[] = [];

  const googleCacheKey = cacheKey;
  const googleCached = googleCache.get(googleCacheKey);
  if (
    googleCached &&
    Date.now() - googleCached.timestamp < GOOGLE_CACHE_DURATION
  ) {
    allPlaces = googleCached.places;
  } else {
    try {
      const googlePlaces = await getPlacesFromGoogle(
        latitude,
        longitude,
        radiusKm,
        types as any,
      );
      if (googlePlaces.length > 0) {
        allPlaces = googlePlaces as Place[];
        googleCache.set(googleCacheKey, {
          places: allPlaces,
          timestamp: Date.now(),
        });
      }
    } catch {}
  }

  if (allPlaces.length === 0) {
    allPlaces = await fetchFromOpenStreetMap(
      latitude,
      longitude,
      radiusKm,
      types,
    );
  }

  if (allPlaces.length > 0)
    placesCache.set(cacheKey, { places: allPlaces, timestamp: Date.now() });
  return allPlaces;
};

const fetchFromOpenStreetMap = async (
  latitude: number,
  longitude: number,
  radiusKm: number,
  types: Place["type"][],
): Promise<Place[]> => {
  const typeToTag: Record<string, string[]> = {
    restaurant: ["amenity=restaurant"],
    cafe: ["amenity=cafe"],
    club: ["amenity=nightclub"],
    beach: ["natural=beach"],
    landmark: ["historic=*"],
    opg: ["shop=farm", "landuse=farmyard"],
    accommodation: [
      "tourism=hotel",
      "tourism=hostel",
      "tourism=motel",
      "tourism=guest_house",
      "tourism=apartment",
    ],
    market: ["amenity=marketplace", "shop=supermarket"],
    cinema: ["amenity=cinema"],
    park: ["leisure=park"],
    museum: ["tourism=museum"],
    theater: ["amenity=theatre"],
    mountain: ["natural=peak"],
    nationalPark: ["leisure=nature_reserve"],
    cave: ["natural=cave_entrance"],
    spa: ["amenity=spa", "leisure=spa"],
    paintball: ["sport=paintball"],
    escapeRoom: ["leisure=escape_game"],
  };

  const groupSize = radiusKm > 100 ? 4 : radiusKm > 50 ? 3 : 2;
  const typeGroups = chunkArray(types, groupSize);
  let allPlaces: Place[] = [];

  for (const group of typeGroups) {
    const tags: string[] = [];
    group.forEach((type) => {
      const tagList = typeToTag[type] || [];
      tagList.forEach((t) => {
        if (!tags.includes(t)) tags.push(t);
      });
    });
    if (tags.length === 0) continue;

    const offset = radiusKm / 85;
    const minLat = latitude - offset,
      maxLat = latitude + offset;
    const minLon = longitude - offset,
      maxLon = longitude + offset;

    const queries = tags.map((tag) => {
      const [key, value] = tag.split("=");
      return value === "*"
        ? `node["${key}"](${minLat},${minLon},${maxLat},${maxLon});`
        : `node["${key}"="${value}"](${minLat},${minLon},${maxLat},${maxLon});`;
    });

    const timeoutSec = radiusKm > 100 ? 60 : radiusKm > 50 ? 50 : 35;
    const overpassQuery = `[out:json][timeout:${timeoutSec}];(${queries.join("")});out body;`;

    const endpoints = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.openstreetmap.fr/api/interpreter",
    ];
    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          timeoutSec * 1000 + 5000,
        );
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(overpassQuery)}`,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) continue;
        const data = await response.json();
        if (!data.elements?.length) continue;

        const places = data.elements
          .map((element: any) => {
            const t = element.tags || {};
            const lat = element.lat,
              lon = element.lon;
            if (!lat || !lon) return null;
            const distance = calculateDistance(latitude, longitude, lat, lon);
            if (distance > radiusKm) return null;

            let placeType: Place["type"] = "landmark";
            if (t.amenity === "restaurant") placeType = "restaurant";
            else if (t.amenity === "cafe") placeType = "cafe";
            else if (t.amenity === "nightclub") placeType = "club";
            else if (t.natural === "beach") placeType = "beach";
            else if (t.shop === "farm" || t.landuse === "farmyard")
              placeType = "opg";
            else if (
              ["hotel", "hostel", "motel", "guest_house", "apartment"].includes(
                t.tourism,
              )
            )
              placeType = "accommodation";
            else if (t.amenity === "marketplace" || t.shop === "supermarket")
              placeType = "market";
            else if (t.amenity === "cinema") placeType = "cinema";
            else if (t.leisure === "park") placeType = "park";
            else if (t.leisure === "escape_game") placeType = "escapeRoom";
            else if (t.tourism === "museum") placeType = "museum";
            else if (t.amenity === "theatre") placeType = "theater";
            else if (t.natural === "peak") placeType = "mountain";
            else if (t.leisure === "nature_reserve") placeType = "nationalPark";
            else if (t.natural === "cave_entrance") placeType = "cave";
            else if (t.amenity === "spa" || t.leisure === "spa")
              placeType = "spa";
            else if (t.sport === "paintball") placeType = "paintball";
            else if (t.historic || t.tourism === "attraction")
              placeType = "landmark";
            else return null;

            if (!group.includes(placeType)) return null;
            const name = t.name || t["name:hr"] || t["name:en"];
            if (!name) return null;
            return {
              id: `${element.type}_${element.id}`,
              name,
              latitude: lat,
              longitude: lon,
              type: placeType,
              distance,
              address: t["addr:street"]
                ? `${t["addr:street"]} ${t["addr:housenumber"] || ""}`.trim()
                : undefined,
            } as Place;
          })
          .filter((p: Place | null): p is Place => p !== null);

        if (places.length > 0) {
          allPlaces.push(...places);
          break;
        }
      } catch {}
    }
  }
  return allPlaces;
};

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
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default {
  searchPlaces,
  getPlacesInRadius,
  placeCategories,
  clearPlacesCache,
  geocodeCity,
};
