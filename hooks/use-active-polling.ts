import { useEffect, useRef } from "react";
import { AppState } from "react-native";

/**
 * Ponavljaj posao samo dok je aplikacija u prvom planu.
 *
 * Obični `setInterval` u React Nativeu nastavlja raditi i kad korisnik izađe
 * iz aplikacije ili ugasi ekran — dretva JavaScripta se ne zaustavlja. Zbog
 * toga je otvoren razgovor slao zahtjev svake 4 sekunde cijelu noć, popis
 * razgovora svakih 20 s, a provjera zahtjeva za praćenje svakih 60 s. Svaki
 * takav zahtjev budi mrežni modem, što je jedan od najskupljih poslova za
 * bateriju — skuplji od samog crtanja ekrana.
 *
 * Ovaj hook zaustavlja ponavljanje čim aplikacija ode u pozadinu i ponovno ga
 * pokreće kad se korisnik vrati, uz jedno odmah izvršeno osvježavanje da se
 * nadoknadi propušteno.
 *
 * @param callback  posao koji se ponavlja (smije se mijenjati između rendera —
 *                  interval se zbog toga ne restartira)
 * @param intervalMs razmak između izvođenja
 * @param enabled   kad je false, ništa se ne izvodi
 */
export function useActivePolling(
  callback: () => void,
  intervalMs: number,
  enabled: boolean = true,
): void {
  // Bez ove reference interval bi se poništavao i iznova stvarao pri svakoj
  // promjeni identiteta funkcije, pa se u praksi nikad ne bi ni odbrojao.
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer !== null) return;
      timer = setInterval(() => saved.current(), intervalMs);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    if (AppState.currentState === "active") start();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        saved.current();
        start();
      } else {
        stop();
      }
    });

    return () => {
      stop();
      subscription.remove();
    };
  }, [intervalMs, enabled]);
}
