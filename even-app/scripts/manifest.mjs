import { writeFileSync } from "node:fs";
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
writeFileSync(
  new URL("../app.json", import.meta.url),
  JSON.stringify(
    {
      package_id: "app.mark.evendotscloud",
      edition: "202601",
      name: "Dot Cloud",
      version: "0.2.0",
      min_sdk_version: "0.0.16",
      entrypoint: "index.html",
      permissions: [
        {
          name: "network",
          desc: "Streams your recordings directly to Soniox (stt-rt.soniox.com) for transcription with your own Soniox key, and sends only the transcribed text and typed messages to your paired cloud relay. Neither your key nor audio is sent to the relay.",
          whitelist: [origin.origin, "wss://stt-rt.soniox.com", "https://stt-rt.soniox.com"],
        },
        {
          name: "g2-microphone",
          desc: "Record for up to 30 seconds through G2 hold or phone buttons. If you enable Hey dots, keep the microphone open for phone-local cue detection while the app is active; only post-cue speech is sent to Soniox for transcription.",
        },
      ],
      supported_languages: ["ko", "en"],
    },
    null,
    2,
  ) + "\n",
);
