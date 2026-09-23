// app/(tabs)/_layout.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Slot, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, AppState, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomNav from "../../components/BottomNav";
import i18n, { languageReady } from "../config/i18n";
import { clearSession, isTokenExpired } from "../../utils/session";
import { TutorialModal, hasSeenTutorial } from "../../components/TutorialModal";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // Vodič se pokazuje jednom, pri prvom ulasku u aplikaciju nakon prijave.
  // Ovdje, a ne na ekranu prijave, jer ispod njega treba stajati aplikacija
  // o kojoj govori.
  const [tutorialOpen, setTutorialOpen] = useState(false);
  // Visina navigacijske trake: ikona+label (cca 68px) + system bar inset
  const navBarHeight = 68 + insets.bottom;

  // Prijava vrijedi 7 dana i ne obnavlja se. Ako istekne dok je aplikacija
  // otvorena (ili se otvori nakon isteka, bez ponovnog pokretanja), svaki
  // zahtjev odavde vraća 401 — a ekrani grešku gutaju, pa se to vidi kao da
  // su podaci nestali: nula pratitelja, nema poruka, nema videa. Umjesto
  // toga korisnika se pošalje na prijavu i kaže mu se zašto.
  const checkSession = useCallback(async () => {
    const token = await AsyncStorage.getItem("token");
    if (!isTokenExpired(token)) return;

    await clearSession();

    // Odabrani jezik se učitava iz AsyncStoragea, pa pri pokretanju zna
    // stići nakon ove provjere. Bez čekanja bi poruka ispala hrvatska i
    // korisniku koji je odabrao neki drugi jezik.
    await languageReady;

    Alert.alert(
      i18n.t("auth.sessionExpiredTitle"),
      i18n.t("auth.sessionExpiredBody"),
    );
    router.replace("/login");
  }, []);

  useEffect(() => {
    hasSeenTutorial().then((seen) => {
      if (!seen) setTutorialOpen(true);
    });
  }, []);

  useEffect(() => {
    checkSession();

    // Telefon zna danima stajati u pozadini — povratak u aplikaciju je
    // trenutak kad je istek najvjerojatniji.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") checkSession();
    });
    return () => subscription.remove();
  }, [checkSession]);

  return (
    <View style={styles.container}>
      <TutorialModal
        visible={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
      />
      <Slot />
      <BottomNav />
      {/* Spacer koji gurne sadržaj iznad navigacijske trake */}
      <View style={{ height: navBarHeight }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
});
