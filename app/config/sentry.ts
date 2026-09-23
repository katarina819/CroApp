// app/config/sentry.ts
//
// Prijava padova i grešaka.
//
// Dosad aplikacija nije imala nikakvo prijavljivanje padova. Kad bi netko
// javio "zatvorilo se samo od sebe", to je bilo sve što se moglo saznati —
// bez zaslona greške, bez toga na kojem se ekranu dogodilo, bez uređaja i
// verzije. Za zatvoreno testiranje je to presudno: bez ovoga se iz kruga
// testiranja ne dobiva podatak, nego dojam.
//
// Slanje je isključeno u razvoju: dok se radi na aplikaciji, svaka
// preinaka koda podigne poneku grešku i to bi samo zatrpalo popis.

import Constants from "expo-constants";
import * as Sentry from "@sentry/react-native";

/** Iz varijable okoline; kad je nema, prijavljivanje se jednostavno ne uključi. */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

export const sentryEnabled = DSN.length > 0 && !__DEV__;

export function initSentry() {
  if (!sentryEnabled) return;

  Sentry.init({
    dsn: DSN,

    // Verzija aplikacije uz svaku grešku — bez toga se ne zna je li pad
    // već popravljen u novijoj gradnji.
    release: Constants.expoConfig?.version ?? "unknown",
    environment: __DEV__ ? "development" : "production",

    // Uzorkovanje performansi: 10% je dovoljno za sliku, a ne troši kvotu.
    tracesSampleRate: 0.1,

    /**
     * Što NE smije otići Sentryju.
     *
     * Aplikacija radi s tokenom u zaglavlju i s lokacijom korisnika. Oboje
     * se zna naći u podacima o zahtjevu koji prati grešku, a ondje nemaju
     * što tražiti.
     */
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.Authorization;
        delete event.request.headers.authorization;
      }
      // Koordinate u adresi zahtjeva (npr. ?lat=45.8&lon=15.9) zamijeni.
      if (event.request?.url) {
        event.request.url = event.request.url.replace(
          /([?&](lat|lon|latitude|longitude)=)[-\d.]+/gi,
          "$1<uklonjeno>",
        );
      }
      return event;
    },
  });
}

/**
 * Poveži grešku s korisnikom — bez e-pošte i imena, samo id.
 *
 * Dovoljno da se vidi pogađa li pad jednog korisnika ili sve, a ne šalje
 * ništa po čemu bi ga se izvan aplikacije moglo prepoznati.
 */
export function setSentryUser(userId: string | number | null) {
  if (!sentryEnabled) return;
  Sentry.setUser(userId === null ? null : { id: String(userId) });
}
