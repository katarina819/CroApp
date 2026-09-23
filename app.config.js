// app.config.js
//
// Statični app.json ne razrješava varijable okoline — što god u njemu piše,
// doslovno završi u gradnji. Zato ključ za Google Maps (Android) više nije
// ondje, nego se ovdje umeće iz okoline.
//
// Ključ je prije stajao upisan u app.jsonu i time bio u gitu. Važno je
// razumjeti što ovo rješava, a što ne: ključ i dalje putuje u APK-u i
// svatko ga odande može izvaditi. Ono što ga štiti je ograničenje u Google
// Cloud Consoleu — na naziv paketa (com.zivac.vara) i SHA-1 otisak potpisa,
// te na samo one API-je koji se koriste. Ovo ovdje sprječava da ključ bude
// u povijesti repozitorija; ograničenje sprječava da nekome koristi.

module.exports = ({ config }) => {
  const mapsKey = process.env.EXPO_PUBLIC_ANDROID_MAPS_API_KEY ?? "";

  if (!mapsKey) {
    // Namjerno upozorenje, ne prekid: `expo start` i provjere u CI-u moraju
    // raditi i bez ključa. Karta bez njega ostaje prazna, pa neka se vidi
    // zašto.
    console.warn(
      "[app.config] EXPO_PUBLIC_ANDROID_MAPS_API_KEY nije postavljen — " +
        "karta na Androidu neće se prikazati. Upiši ga u .env (lokalno) " +
        "ili u EAS tajne (gradnja).",
    );
  }

  return {
    ...config,
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: { apiKey: mapsKey },
      },
    },
  };
};
