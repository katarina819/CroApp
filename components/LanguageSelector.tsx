import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { saveLanguage } from "../app/config/i18n";

const LANGUAGES = [
  { code: "hr", flag: "🇭🇷" },
  { code: "en", flag: "🇬🇧" },
  { code: "it", flag: "🇮🇹" },
  { code: "de", flag: "🇩🇪" },
  { code: "fr", flag: "🇫🇷" },
];

export default function LanguageSelector() {
  const { t, i18n } = useTranslation();
  const [visible, setVisible] = useState(false);

  const current =
    LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  return (
    <>
      <TouchableOpacity style={s.trigger} onPress={() => setVisible(true)}>
        <Text style={s.flag}>{current.flag}</Text>
        <Text style={s.langName}>{t(`languages.${current.code}`)}</Text>
        <Text style={s.arrow}>▾</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity style={s.overlay} onPress={() => setVisible(false)}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>{t("auth.language")}</Text>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  s.option,
                  i18n.language === lang.code && s.optionActive,
                ]}
                onPress={() => {
                  saveLanguage(lang.code);
                  setVisible(false);
                }}
              >
                <Text style={s.optionFlag}>{lang.flag}</Text>
                <Text
                  style={[
                    s.optionText,
                    i18n.language === lang.code && s.optionTextActive,
                  ]}
                >
                  {t(`languages.${lang.code}`)}
                </Text>
                {i18n.language === lang.code && <Text style={s.check}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  flag: { fontSize: 18 },
  langName: { color: "#fff", fontSize: 13, fontWeight: "600" },
  arrow: { color: "#fff", fontSize: 10 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: 260,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  optionActive: { backgroundColor: "#f0f7ee" },
  optionFlag: { fontSize: 22 },
  optionText: { flex: 1, fontSize: 15, color: "#333" },
  optionTextActive: { color: "#2D6418", fontWeight: "700" },
  check: { color: "#2D6418", fontSize: 16, fontWeight: "700" },
});
