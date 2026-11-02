import { fileURLToPath } from "node:url";
import { rmSync, writeFileSync } from "node:fs";
import { verifyBundleNetwork } from "./lib/network-whitelist.mjs";
const manifestPath = new URL("../app.json", import.meta.url);
// Drop any earlier manifest first so a failed check cannot leave one behind for pack.
rmSync(manifestPath, { force: true });
const origin = new URL(process.env.RELAY_ORIGIN || "");
if (
  origin.protocol !== "https:" ||
  origin.pathname !== "/" ||
  origin.search ||
  origin.hash ||
  origin.username ||
  origin.password
)
  throw new Error("Set RELAY_ORIGIN to the deployed HTTPS relay origin.");
// The Soniox Console and the project's GitHub pages are fixed links the user opens from the phone page.
const whitelist = [
  origin.origin,
  "wss://stt-rt.soniox.com",
  "https://stt-rt.soniox.com",
  "https://console.soniox.com",
  "https://github.com",
];
await verifyBundleNetwork(fileURLToPath(new URL("../dist/", import.meta.url)), whitelist);
writeFileSync(
  manifestPath,
  JSON.stringify(
    {
      package_id: "app.mark.evendotscloud",
      edition: "202601",
      name: "Dots Lens for G2",
      version: "0.8.0",
      min_sdk_version: "0.0.16",
      entrypoint: "index.html",
      permissions: [
        {
          name: "network",
          desc: "Sends audio directly to Soniox with your key; only typed or transcribed text reaches your relay. Your key and audio never reach the relay. Tapping help links opens Soniox Console or the project's GitHub guide and issues in your browser, without app data.",
          whitelist,
        },
        {
          name: "g2-microphone",
          desc: "Record for up to 30 seconds through G2 hold or phone buttons. Hey dots is on by default and can be turned off: while the app is active, paired and has a Soniox key, the microphone stays open for phone-local cue detection; only post-cue speech is sent to Soniox for transcription.",
        },
      ],
      // Every language the companion UI is fully translated into (src/locale.ts LANGUAGES); Even Hub accepts only
      // en, de, fr, es, it, zh, ja and ko.
      supported_languages: ["en", "de", "fr", "es", "it", "zh", "ja", "ko"],
    },
    null,
    2,
  ) + "\n",
);
