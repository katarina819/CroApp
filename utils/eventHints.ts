// utils/eventHints.ts
//
// Nagovještaj da je objava najava događaja.
//
// NAMJERNO nije odluka nego prijedlog: prekidač "Ovo je događaj" se samo
// unaprijed uključi, a autor ga može odmah isključiti. Pogađanje iz teksta
// bi u suprotnom proizvodilo krive datume i lažne najave — a autor ionako
// zna bolje od bilo kakve heuristike.

/** Riječi koje se pojavljuju u najavama, na svih pet jezika aplikacije. */
const EVENT_WORDS = [
  // hr
  "koncert",
  "nastup",
  "svirka",
  "izlet",
  "radionica",
  "predstava",
  "premijera",
  "turnir",
  "okupljanje",
  "najava",
  "ulaznice",
  "rezerviraj",
  "prijave",
  "obilježavanje",
  // en
  "concert",
  "gig",
  "workshop",
  "tournament",
  "meetup",
  "tickets",
  "hike",
  "trip",
  // de
  "konzert",
  "auftritt",
  "workshop",
  "turnier",
  "eintrittskarten",
  "wanderung",
  // fr
  "concert",
  "spectacle",
  "atelier",
  "tournoi",
  "billets",
  "randonnée",
  // it
  "concerto",
  "spettacolo",
  "laboratorio",
  "torneo",
  "biglietti",
  "escursione",
  // svugdje
  "festival",
  "live",
  "dj",
];

/** 23.09. / 23.9.2026 / 23-09 / 23/09 — dan i mjesec u europskom zapisu. */
const DATE_PATTERN = /\b\d{1,2}\s*[./-]\s*\d{1,2}(\s*[./-]\s*\d{2,4})?\.?\b/;

/** hh:mm, npr. 21:00 ili 9.30 h */
const TIME_PATTERN = /\b\d{1,2}[:.]\d{2}\b/;

/**
 * Izgleda li tekst objave kao najava. Traži ili riječ iz popisa, ili datum
 * u kombinaciji s vremenom — sam datum je preslab (npr. "slikano 12.8.").
 */
export function looksLikeEvent(
  ...parts: (string | null | undefined)[]
): boolean {
  const text = parts.filter(Boolean).join(" ").toLowerCase();
  if (!text.trim()) return false;

  if (EVENT_WORDS.some((word) => text.includes(word))) return true;
  return DATE_PATTERN.test(text) && TIME_PATTERN.test(text);
}
