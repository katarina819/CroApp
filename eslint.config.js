// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "node_modules/*", ".expo/*"],
  },
  {
    rules: {
      // Pravila iz eslint-plugin-import su isključena jer im razrješivač
      // (eslint-import-resolver-typescript) u ovoj kombinaciji verzija ne
      // radi — eslint-module-utils je podignut u korijen, a razrješivač je
      // ugniježđen u eslint-config-expo, pa ga učita s krivim sučeljem i
      // cijeli lint pukne ("typescript with invalid interface loaded as
      // resolver"). Zbog toga `npm run lint` dosad uopće nije radio.
      //
      // Gubitak je malen: TypeScript već provjerava postoje li uvozi i
      // izvozi, a `tsc --noEmit` se u CI-u vrti uz lint. Vrijedna pravila
      // iz Expove konfiguracije (react-hooks) ostaju uključena.
      "import/namespace": "off",
      "import/default": "off",
      "import/no-named-as-default": "off",
      "import/no-named-as-default-member": "off",
      "import/no-unresolved": "off",
      "import/export": "off",
      "import/no-duplicates": "off",
    },
  },
]);
