// app/services/googlePlacesService.ts (NOVA DATOTEKA)
import { Place } from "./locationService";

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// Mapiranje naših tipova na Google Places tipove
const mapTypeToGoogleType = (type: Place["type"]): string => {
  const mapping: Record<string, string> = {
    restaurant: "restaurant",
    cafe: "cafe",
    club: "night_club",
    beach: "beach",
    landmark: "tourist_attraction",
    farm: "farm",
    cinema: "movie_theater",
    park: "park",
    museum: "museum",
    theater: "theater",
    spa: "spa",
    // Za ostale koje Google nema, koristimo "point_of_interest"
  };
  return mapping[type] || "point_of_interest";
};

// Dohvat s Google Places API (Nearby Search)
export const getPlacesFromGoogle = async (
  latitude: number,
  longitude: number,
  radiusKm: number,
  types: Place["type"][],
): Promise<Place[]> => {
  if (!GOOGLE_MAPS_API_KEY) {
    console.log("Google Maps API key not found");
    return [];
  }

  const allPlaces: Place[] = [];

  // Google API limit je 50km, pretvorimo km u metre
  const radiusMeters = Math.min(radiusKm * 1000, 50000);

  // Paralelno dohvaćanje za svaki tip
  const promises = types.map(async (type) => {
    const googleType = mapTypeToGoogleType(type);

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radiusMeters}&type=${googleType}&key=${GOOGLE_MAPS_API_KEY}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) return [];

      const data = await response.json();

      if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
        console.log(`Google Places API error for ${type}: ${data.status}`);
        return [];
      }

      return data.results.map(
        (item: any): Place => ({
          id: item.place_id,
          name: item.name,
          latitude: item.geometry.location.lat,
          longitude: item.geometry.location.lng,
          type: type,
          rating: item.rating,
          address: item.vicinity,
          distance: calculateDistance(
            latitude,
            longitude,
            item.geometry.location.lat,
            item.geometry.location.lng,
          ),
          phone: item.formatted_phone_number,
          openingHours: item.opening_hours?.open_now ? "Open now" : undefined,
        }),
      );
    } catch (error) {
      console.error(`Error fetching ${type} from Google:`, error);
      return [];
    }
  });

  const results = await Promise.all(promises);
  results.forEach((places) => allPlaces.push(...places));

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

export default { getPlacesFromGoogle };
