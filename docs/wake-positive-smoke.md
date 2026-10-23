# Offline positive Hey dots smoke

On 2026-10-23, the shipped local detector produced a `wake` event and a following WAV `clip` from synthetic English **“Hey dots. What time is it?”**. One unrelated sentence and silence produced neither event. This establishes that the configured keyword can activate; it does not establish user, phone, or G2 accuracy.

## Exact input generation and execution

Host: macOS 27.0.1 (26A434), arm64; Node v26.12.0. The installed voice inventory included `Samantha` (`en_US`). No voice was downloaded or installed. `say -o` generated files without audible playback.

Run from the repository root:

```sh
/usr/bin/say -v Samantha -r 150 -o outputs/wake-smoke/positive.aiff 'Hey dots. What time is it?'
/usr/bin/afconvert -f WAVE -d LEI16@16000 -c 1 outputs/wake-smoke/positive.aiff outputs/wake-smoke/positive.wav
/usr/bin/say -v Samantha -r 150 -o outputs/wake-smoke/negative.aiff 'The weather is nice today.'
/usr/bin/afconvert -f WAVE -d LEI16@16000 -c 1 outputs/wake-smoke/negative.aiff outputs/wake-smoke/negative.wav
node --experimental-strip-types outputs/wake-smoke/run.mjs
```

The ignored harness validates WAV PCM encoding 1, mono, 16 kHz, 16-bit. It verifies every asset against `even-app/distribution/wake/manifest.json`, then imports the actual `even-app/src/wake-worker.ts` and initializes it with `name: "dots"`. The harness mirrors the existing packaged-WASM test host. All fetches are restricted to `file:` URLs under the packaged local asset directory; six local model/vocabulary fetches occurred. No network, cloud STT, API/provider, GUI, device, or account actions were used. Existing app sources and settings were read-only.

Each case uses a new detector `listen` generation, 1 second of leading silence, the source PCM, and 8 seconds of trailing silence. The silence control has 5 seconds of source silence. PCM is supplied in 640-byte (20 ms) frames, faster than real time. The harness cancels each generation after the case. Output is saved under ignored `outputs/wake-smoke/`, outside app/public/package directories.

## Unchanged detector settings

- sherpa-onnx 1.13.8; int8 Zipformer GigaSpeech 3.3M English KWS; fixed custom name `dots` tokenizes `HEY DOTS`.
- 16 kHz features, feature dimension 80, one CPU thread, four active paths, one trailing blank, keyword score 3, keyword threshold 0.1.
- Silero VAD: threshold 0.5, 1.2-second silence, minimum speech 0.3 seconds, 512-sample windows, 30-second maximum speech.
- Existing WakeEngine timestamp trimming, six-second no-speech expiry, and 30-second clip cap. The positive frame stream did not alter production thresholds or settings.

## Observed result

| Case | Source duration | Padded duration | Decode elapsed | Events |
| --- | ---: | ---: | ---: | --- |
| Samantha: “Hey dots. What time is it?” | 2.1059375 s | 11.1059375 s | 105.32 ms | `wake`; `clip`, 2.18 s, 69,804 WAV bytes |
| Samantha: “The weather is nice today.” | 1.7269375 s | 10.7269375 s | 286.40 ms | None |
| Digital silence | 5 s | 14 s | 364.48 ms | None |

Runtime/model initialization took 502.07 ms. Node reported final process RSS 310,661,728 bytes and `resourceUsage().maxRSS` 344,064 KiB (about 336 MiB). These are desktop Node/WASM host measurements, including the test harness, not phone memory/battery measurements or real-time callback latency. Faster positive processing reflects capture completion leaving the engine idle for the remaining frames.

Full structured evidence: `outputs/wake-smoke/results.json`; executable harness: `outputs/wake-smoke/run.mjs`; captured generated post-cue WAV: `outputs/wake-smoke/positive-clip.wav`.

SHA-256:

```text
ca183b165de4477946ab38904d8367965452b1d9d25c349c919ffdf02410e860  positive.wav
f00412f12e6128420ddde9e2b5c4896a924e68321fb417c51ec19e29ad034d6a  negative.wav
28f08b16da2534e80b6e3c95959066865d5f0c0e33646817d3c77602c13ae2a6  positive-clip.wav
```

## Limits

One synthetic English voice and one unrelated negative are a smoke test, not an accuracy or false-accept estimate. The saved post-cue clip was not listened to or transcribed, so acoustic cue exclusion is not independently established here; deterministic timestamp-trimming tests cover the engine rule separately. Korean-accented pronunciation, human speakers, noise, G2 transport/frame timing, physical microphone capture, optical display, phone resource use, background lifecycle, and real MCP delivery remain unverified. No tuning or production code changes were made for this experiment.
