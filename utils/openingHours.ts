// utils/openingHours.ts
//
// Tumačenje OSM-ovog polja `opening_hours` (i Googleovog "Monday: 9:00 AM –
// 5:00 PM" oblika).
//
// Zašto vlastiti parser: prijašnja verzija je prepoznavala samo JEDAN raspon
// vremena po pravilu i samo rastuće raspone dana, pa je na karti griješila
// upravo ondje gdje je najvidljivije:
//
//   "Mo-Fr 08:00-12:00,17:00-20:00"  — podijeljeno radno vrijeme (stanka za
//        ručak) uopće se nije prepoznalo, pa je mjesto ostajalo "nepoznato" i
//        prolazilo kroz grubu procjenu po kategoriji;
//   "Su-Th 18:00-02:00"  — raspon dana koji prelazi kraj tjedna nije se
//        podudarao ni s jednim danom, pa je klub u srijedu u 22 h ispadao
//        ZATVOREN iako radi;
//   "Mo-Fr 09:00-17:00 open"  — višak ključne riječi rušio je cijelo pravilo.
//
// Vrijednosti: true = otvoreno, false = zatvoreno, null = ne može se utvrditi
// (tada se ne smije ništa tvrditi ni sakriti — bolje pokazati mjesto nego ga
// krivo izbaciti).

export type OpenState = boolean | null;

const DAY_INDEX: Record<string, number> = {
  mo: 0,
  mon: 0,
  monday: 0,
  pon: 0,
  ponedjeljak: 0,
  tu: 1,
  tue: 1,
  tuesday: 1,
  uto: 1,
  utorak: 1,
  we: 2,
  wed: 2,
  wednesday: 2,
  sri: 2,
  srijeda: 2,
  th: 3,
  thu: 3,
  thursday: 3,
  cet: 3,
  čet: 3,
  četvrtak: 3,
  fr: 4,
  fri: 4,
  friday: 4,
  pet: 4,
  petak: 4,
  sa: 5,
  sat: 5,
  saturday: 5,
  sub: 5,
  subota: 5,
  su: 6,
  sun: 6,
  sunday: 6,
  ned: 6,
  nedjelja: 6,
};

/**
 * Konstrukti koje ovaj parser ne zna izračunati. Kad se pojave, vraćamo null
 * umjesto da nagađamo — mjesto tada ostaje vidljivo na karti.
 */
const UNSUPPORTED = [
  /\bsunrise\b/,
  /\bsunset\b/,
  /\bdawn\b/,
  /\bdusk\b/,
  /\beaster\b/,
  /\bweek\s*\d/,
  /\bschool\s*holiday\b/,
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/,
  /"/,
];

/** "Mo-Fr", "Sa,Su", "Su-Th" (prelazi kraj tjedna) → skup indeksa dana. */
function daysFromSpec(spec: string): Set<number> | null {
  const days = new Set<number>();
  let sawAny = false;

  for (const rawPart of spec.split(",")) {
    const part = rawPart.trim();
    if (!part) continue;

    const range = part.match(/^([a-zčć]+)\s*-\s*([a-zčć]+)$/);
    if (range) {
      const from = DAY_INDEX[range[1]];
      const to = DAY_INDEX[range[2]];
      if (from === undefined || to === undefined) return null;
      sawAny = true;
      // Raspon smije prelaziti kraj tjedna: Su-Th = Su, Mo, Tu, We, Th.
      let d = from;
      for (let guard = 0; guard < 7; guard++) {
        days.add(d);
        if (d === to) break;
        d = (d + 1) % 7;
      }
      continue;
    }

    const single = DAY_INDEX[part];
    if (single === undefined) return null;
    sawAny = true;
    days.add(single);
  }

  return sawAny ? days : null;
}

function minutesFromClock(text: string): number | null {
  const m = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || min > 59 || h > 48)
    return null;
  return h * 60 + min;
}

interface TimeSpan {
  open: number;
  /** Može prijeći 24 h (npr. 18:00-02:00 → 1080..1560). */
  close: number;
}

/** "08:00-12:00,17:00-20:00" → dva raspona. "off"/"closed" → prazan niz. */
function spansFromSpec(spec: string): TimeSpan[] | null {
  const text = spec.trim();
  if (!text) return null;
  if (/^(off|closed|zatvoreno)$/.test(text)) return [];

  const spans: TimeSpan[] = [];
  for (const rawPart of text.split(",")) {
    const part = rawPart.trim();
    if (!part) continue;
    if (part === "24/7" || part === "00:00-24:00") {
      spans.push({ open: 0, close: 24 * 60 });
      continue;
    }
    const m = part.match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/);
    if (!m) return null;
    const open = minutesFromClock(m[1]);
    const closeRaw = minutesFromClock(m[2]);
    if (open === null || closeRaw === null) return null;
    // 18:00-02:00 znači da se zatvara sljedećeg dana.
    const close = closeRaw <= open ? closeRaw + 24 * 60 : closeRaw;
    spans.push({ open, close });
  }
  return spans.length > 0 ? spans : null;
}

interface Rule {
  days: Set<number> | null; // null = vrijedi svaki dan
  spans: TimeSpan[]; // prazno = zatvoreno
}

function parseRules(spec: string): Rule[] | null {
  const rules: Rule[] = [];
  let sawUnparseable = false;

  for (const rawRule of spec.split(";")) {
    let rule = rawRule.trim();
    if (!rule) continue;

    // "PH off", "PH 10:00-14:00" — praznike ne možemo znati, preskačemo ih.
    if (/^ph\b/.test(rule)) continue;
    // Višak ključnih riječi: "09:00-17:00 open", "Mo-Fr 09:00-17:00 unknown".
    rule = rule.replace(/\s+(open|unknown)$/, "").trim();

    // Odvoji oznaku dana od oznake vremena.
    const m = rule.match(
      /^([a-zčć,\s-]*?)\s*((?:\d{1,2}:\d{2}[\s–-]*\d{1,2}:\d{2}[,\s]*)+|off|closed|zatvoreno|24\/7)$/,
    );
    if (!m) {
      sawUnparseable = true;
      continue;
    }

    const daySpecText = m[1].trim();
    const days = daySpecText ? daysFromSpec(daySpecText) : null;
    if (daySpecText && days === null) {
      sawUnparseable = true;
      continue;
    }

    const spans = spansFromSpec(m[2]);
    if (spans === null) {
      sawUnparseable = true;
      continue;
    }

    rules.push({ days, spans });
  }

  if (rules.length === 0) return sawUnparseable ? null : null;
  return rules;
}

/** Google Places oblik: "Monday: 9:00 AM – 5:00 PM" po retku. */
function parseGoogleFormat(
  spec: string,
  day: number,
  minutes: number,
): OpenState {
  const lines = spec
    .split(/[\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  let sawToday = false;

  for (const line of lines) {
    const m = line.match(/^([a-zčć]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const lineDay = DAY_INDEX[m[1]];
    if (lineDay === undefined || lineDay !== day) continue;
    sawToday = true;

    const body = m[2].trim();
    if (/^(closed|zatvoreno)$/.test(body)) return false;

    let anyParsed = false;
    for (const part of body.split(",")) {
      const t = part.match(
        /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/,
      );
      if (!t) continue;
      anyParsed = true;
      const to24 = (
        h: string,
        mm: string | undefined,
        ap: string | undefined,
      ) => {
        let hours = Number(h);
        if (ap === "pm" && hours !== 12) hours += 12;
        if (ap === "am" && hours === 12) hours = 0;
        return hours * 60 + Number(mm ?? 0);
      };
      const open = to24(t[1], t[2], t[3]);
      let close = to24(t[4], t[5], t[6]);
      if (close <= open) close += 24 * 60;
      const cur = minutes < open ? minutes + 24 * 60 : minutes;
      if (cur >= open && cur < close) return true;
    }
    if (anyParsed) return false;
    return null;
  }

  // Dan uopće nije naveden — ne tvrdimo ništa.
  return sawToday ? null : null;
}

/**
 * Je li mjesto otvoreno u trenutku `when`?
 *
 * @returns true / false, ili null kad se iz zapisa ne može zaključiti.
 */
export function isOpenAt(
  spec: string | null | undefined,
  when: Date,
): OpenState {
  if (!spec) return null;

  // Razmaci se sažimaju, ali NOVI REDCI se čuvaju: Googleov oblik dolazi kao
  // jedan dan po retku, pa bi njihovo sažimanje spojilo sve dane u jedan red.
  const text = spec
    .toLowerCase()
    .trim()
    .replace(/[ \t]+/g, " ");
  if (!text) return null;
  if (text === "24/7" || text === "mo-su 00:00-24:00") return true;

  // JS: 0 = nedjelja. OSM: 0 = ponedjeljak.
  const jsDay = when.getDay();
  const day = jsDay === 0 ? 6 : jsDay - 1;
  const minutes = when.getHours() * 60 + when.getMinutes();

  if (/\b(am|pm)\b/.test(text) || /^\s*[a-zčć]+\s*:/.test(text)) {
    const viaGoogle = parseGoogleFormat(text, day, minutes);
    if (viaGoogle !== null) return viaGoogle;
  }

  if (UNSUPPORTED.some((re) => re.test(text))) return null;

  // OSM zapis je jednoredni; eventualni prijelomi redaka ovdje samo smetaju.
  const rules = parseRules(text.replace(/\n+/g, " "));
  if (!rules || rules.length === 0) return null;

  // Provjeri i jučerašnja pravila: raspon 18:00-02:00 s jučer pokriva 01:00
  // danas. Bez toga bi klub u 01 h uvijek ispadao zatvoren.
  const probes: { day: number; minutes: number }[] = [
    { day, minutes },
    { day: (day + 6) % 7, minutes: minutes + 24 * 60 },
  ];

  let todayMentioned = false;
  let result: OpenState = null;

  for (const probe of probes) {
    for (const rule of rules) {
      if (rule.days !== null && !rule.days.has(probe.day)) continue;
      if (
        probe.minutes >= 24 * 60 &&
        rule.spans.every((s) => s.close <= 24 * 60)
      ) {
        // Jučerašnje pravilo bez prelaska ponoći ne može pokrivati danas.
        continue;
      }
      if (probe.day === day) todayMentioned = true;

      const open = rule.spans.some(
        (s) => probe.minutes >= s.open && probe.minutes < s.close,
      );
      // U OSM-u kasnije pravilo nadjačava ranije za isti dan
      // ("Tu-Su 10:00-18:00; We off" u srijedu znači zatvoreno).
      if (probe.day === day) result = open;
      else if (open) return true;
    }
  }

  if (todayMentioned) return result;

  // Postoje razumljiva pravila, ali nijedno ne spominje danas → zatvoreno.
  return false;
}

/** Kratki opis stanja za prikaz, bez pretvaranja da znamo ono što ne znamo. */
export function openStateLabel(
  state: OpenState,
  labels: { open: string; closed: string },
): string | null {
  if (state === true) return labels.open;
  if (state === false) return labels.closed;
  return null;
}

/**
 * Je li mjesto otvoreno IKAD unutar odabranog razdoblja dana (npr. "navečer"
 * = 18–24 h) na dan iz `when`?
 *
 * Filter po dobu dana prije je provjeravao je li mjesto otvoreno U TOM
 * TRENUTKU, a ne u odabranom razdoblju — pa je odabir "navečer" u 14 h
 * izbacivao svaki klub i kazalište, jer tada doista još ne rade. Zbog toga je
 * postojala i iznimka koja je klubovima i kazalištima preskakala provjeru, a
 * ona je onda propuštala i one koji su stvarno zatvoreni.
 *
 * @param fromHour početak razdoblja u satima (uključivo)
 * @param toHour   kraj razdoblja u satima (isključivo)
 */
export function isOpenDuringWindow(
  spec: string | null | undefined,
  when: Date,
  fromHour: number,
  toHour: number,
): OpenState {
  if (!spec) return null;

  const STEP_MINUTES = 30;
  const start = Math.round(fromHour * 60);
  const end = Math.round(toHour * 60);
  let sawKnown = false;

  for (let m = start; m < end; m += STEP_MINUTES) {
    const probe = new Date(when);
    probe.setHours(0, 0, 0, 0);
    probe.setMinutes(m);

    const state = isOpenAt(spec, probe);
    if (state === true) return true;
    if (state === false) sawKnown = true;
  }

  return sawKnown ? false : null;
}
