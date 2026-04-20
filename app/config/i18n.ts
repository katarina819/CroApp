import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import de from "../locales/de.json";
import en from "../locales/en.json";
import fr from "../locales/fr.json";
import hr from "../locales/hr.json";
import it from "../locales/it.json";

const LANGUAGE_KEY = "vara_language";

// Dohvati spremljeni jezik ili koristi jezik uređaja
const getStoredLanguage = async (): Promise<string> => {
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (stored) return stored;

    // Fallback na jezik uređaja
    const deviceLang = Localization.getLocales()[0]?.languageCode ?? "en";
    const supported = ["hr", "en", "it", "de", "fr"];
    return supported.includes(deviceLang) ? deviceLang : "en";
  } catch {
    return "en";
  }
};

export const saveLanguage = async (lang: string) => {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  i18n.changeLanguage(lang);
};

i18n.use(initReactI18next).init({
  resources: {
    hr: { translation: hr },
    en: { translation: en },
    it: { translation: it },
    de: { translation: de },
    fr: { translation: fr },
  },
  lng: "hr",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

// Postavi jezik pri pokretanju
getStoredLanguage().then((lang) => i18n.changeLanguage(lang));

export default i18n;
