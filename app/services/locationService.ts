// app/services/locationService.ts
import { API_BASE_URL } from "../config/api";

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
    | "other";
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
    icon: "🏛️",
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
  other: {
    name: "Ostalo",
    icon: "📍",
    color: "#95A5A6",
    marker: "other",
    osmTag: "",
  },
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
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 🔥 DODANO: timeout 10s

    const response = await fetch(url, {
      headers: {
        "User-Agent": "CroMapApp/1.0",
      },
      signal: controller.signal, // 🔥 DODANO: abort signal
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

  if (type === "restaurant" || class_ === "restaurant") return "restaurant";
  if (type === "cafe" || class_ === "cafe") return "cafe";
  if (type === "nightclub" || type === "bar" || class_ === "nightclub")
    return "club";
  if (type === "beach" || class_ === "beach") return "beach";
  if (type === "historic" || type === "tourism" || class_ === "attraction")
    return "landmark";
  if (type === "farm" || class_ === "farm") return "farm";

  return "other";
};

// Dohvati mjesta u radijusu - glavna funkcija
export const getPlacesInRadius = async (
  latitude: number,
  longitude: number,
  radiusKm: number,
  types?: Place["type"][],
): Promise<Place[]> => {
  if (!types || types.length === 0) {
    console.log("No types selected, returning empty array");
    return [];
  }

  console.log(
    `Fetching places for types: ${types.join(", ")}, radius: ${radiusKm}km`,
  );

  // 🔥 PRVO POKUŠAJ S BACKEND-OM
  try {
    const backendPlaces = await fetchFromBackend(
      latitude,
      longitude,
      radiusKm,
      types,
    );
    if (backendPlaces.length > 0) {
      console.log(`Found ${backendPlaces.length} places from backend`);
      return backendPlaces;
    }
  } catch (error) {
    console.log("Backend not available, using OpenStreetMap");
  }

  // 🔥 FALLBACK NA OPENSTREETMAP
  return fetchFromOpenStreetMap(latitude, longitude, radiusKm, types);
};

// Dohvat s backend-a
const fetchFromBackend = async (
  latitude: number,
  longitude: number,
  radiusKm: number,
  types: Place["type"][],
): Promise<Place[]> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 🔥 timeout 8s

    const response = await fetch(`${API_BASE_URL}/api/places/nearby`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        latitude,
        longitude,
        radius: radiusKm,
        types,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.places || [];
  } catch (error) {
    console.error("Error fetching from backend:", error);
    return [];
  }
};

// Dohvat s OpenStreetMap - JEDAN ZAHTJEV ZA SVE TIPOVE
const fetchFromOpenStreetMap = async (
  latitude: number,
  longitude: number,
  radiusKm: number,
  types: Place["type"][],
): Promise<Place[]> => {
  // Mapiranje tipova na OSM tagove
  const typeToTag: Record<string, string> = {
    restaurant: "amenity=restaurant",
    cafe: "amenity=cafe",
    club: "amenity=nightclub",
    beach: "natural=beach",
    landmark: "historic=*",
    farm: "shop=farm",
    other: "",
  };

  // Kreiraj JEDAN query za sve tipove (umjesto više zasebnih)
  const tags: string[] = [];
  types.forEach((type) => {
    const tag = typeToTag[type];
    if (tag && !tags.includes(tag)) {
      tags.push(tag);
    }
  });

  if (tags.length === 0) {
    return [];
  }

  console.log(`Fetching from OpenStreetMap for tags: ${tags.join(", ")}`);

  // Izračunaj bounding box
  const offset = radiusKm / 100;
  const minLat = latitude - offset;
  const maxLat = latitude + offset;
  const minLon = longitude - offset;
  const maxLon = longitude + offset;

  // 🔥 JEDAN query za sve tagove
  const queries = tags.map((tag) => {
    const [key, value] = tag.split("=");
    if (value === "*") {
      return `node["${key}"](${minLat},${minLon},${maxLat},${maxLon});`;
    } else {
      return `node["${key}"="${value}"](${minLat},${minLon},${maxLat},${maxLon});`;
    }
  });

  const overpassQuery = `
    [out:json][timeout:15];
    (
      ${queries.join("\n")}
    );
    out body;
  `;

  // 🔥 VIŠE ENDPOINTA ZA FALLBACK
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Trying OpenStreetMap endpoint: ${endpoint}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 🔥 timeout 15s

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.log(`Endpoint ${endpoint} returned ${response.status}`);
        continue;
      }

      const text = await response.text();

      if (!text.trim().startsWith("{")) {
        console.log(`Invalid response from ${endpoint} (not JSON)`);
        continue;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.log(`JSON parse error from ${endpoint}`);
        continue;
      }

      if (!data.elements || !Array.isArray(data.elements)) {
        console.log(`No elements from ${endpoint}`);
        continue;
      }

      const places = data.elements
        .map((element: any) => {
          const tags = element.tags || {};
          const lat = element.lat;
          const lon = element.lon;

          if (!lat || !lon) return null;

          const distance = calculateDistance(latitude, longitude, lat, lon);
          if (distance > radiusKm) return null;

          // Odredi tip
          let placeType: Place["type"] = "other";
          if (tags.amenity === "restaurant") placeType = "restaurant";
          else if (tags.amenity === "cafe") placeType = "cafe";
          else if (tags.amenity === "nightclub") placeType = "club";
          else if (tags.natural === "beach") placeType = "beach";
          else if (tags.historic || tags.tourism === "attraction")
            placeType = "landmark";
          else if (tags.shop === "farm") placeType = "farm";

          // Provjeri da li je tip u odabranim tipovima
          if (!types.includes(placeType)) return null;

          const name = tags.name || tags["name:hr"] || tags["name:en"];
          if (!name) return null;

          return {
            id: element.id.toString(),
            name: name,
            latitude: lat,
            longitude: lon,
            type: placeType,
            description: tags.description || "",
            distance: distance,
            phone: tags.phone || tags["contact:phone"],
            website: tags.website || tags.url,
            openingHours: tags.opening_hours,
          } as Place;
        })
        .filter((place: Place | null): place is Place => place !== null);

      console.log(`Found ${places.length} places from ${endpoint}`);

      if (places.length > 0) {
        return places;
      }
    } catch (error) {
      console.log(`Error with endpoint ${endpoint}:`, error);
      continue;
    }
  }

  console.log("All OpenStreetMap endpoints failed");
  return [];
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
};
