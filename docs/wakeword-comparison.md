# Wake word engine comparison: sherpa-onnx KWS vs openWakeWord

Scope: phone-local "Hey dots" detection in the Even Hub iPhone WebView (WASM worker), with G2 16 kHz mono PCM input, a fixed English cue, and the following Korean speech sent to cloud STT.
Sources accessed: 2026-10-23. Method: desk research only. No benchmarks, model downloads, device runs or audio tests were performed.

Subsequent project evidence: a separate [sherpa-only synthetic positive smoke](wake-positive-smoke.md) activated `Hey dots`. It does not compare the engines or establish human/phone performance; the comparison conclusions below remain based on desk research.

## TL;DR

- **Keep sherpa-onnx KWS for this prototype while measuring accuracy.** It is already integrated, and the packaged runtime/models initialize in our offline test. Physical iPhone WebView operation remains unverified. Keywords can change without model retraining; our current companion fixes the phrase to `Hey dots` rather than exposing a name picker.
- **There is no fair head-to-head data.** Neither project publishes numbers on the same audio, threshold sweep or hardware. Each project's own numbers come from different datasets and different keywords. Neither publishes anything for "hey dots".
- **openWakeWord is a poor fit for this app as-is:**
  - Its pretrained models are CC BY-NC-SA 4.0 (non-commercial).
  - There is no official browser runtime.
  - A new phrase absent from its pretrained models, such as `Hey dots`, needs a trained classifier.
  - Runtime-editable names would require one classifier per phrase. This is a future extensibility difference, not a missing feature in our current fixed-phrase app.
- **Action:** run the benchmark plan below on the same G2 recordings before changing engines. Also resolve one licensing gap in the current setup (see Licensing).

## What we run today (read from the repo)

| Item | Value | Source |
|---|---|---|
| Runtime | sherpa-onnx 1.13.8 WASM (emsdk 4.0.23), commit `11afbd0`; heap 64 MiB initial, 256 MiB max; single thread; WASM SIMD required | Dot Link reference `distribution/wake/manifest.json`, `even-app/public/REFERENCE-WAKE-WORD.md` |
| KWS model | `sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01`, int8, `chunk-16-left-64` | manifest |
| Files | encoder 4.81 MB + decoder 0.28 MB + joiner 0.16 MB + tokens 5 KB; `runtime.wasm` 12.8 MB (gzip variant exists); `silero_vad.onnx` 0.64 MB | `even-app/public/wake-assets/` |
| Keyword config | One keyword (`▁HEY▁<NAME>` tokens, `@HEY_DOT`); `keywordsScore: 3`, `keywordsThreshold: 0.1`, `maxActivePaths: 4`, `numTrailingBlanks: 1` | `even-app/src/wake-worker.ts:48-65` |
| VAD role | Silero VAD (threshold 0.5) is used only for post-wake endpointing (1.2 s silence). It does not gate the detector. | `even-app/src/wake-engine.ts`, `wake-worker.ts:67-80` |

Our threshold of 0.1 and score of 3 make triggering much easier than the upstream example defaults (`keywords_threshold=0.25`, `keywords_score=1`). Upstream says a lower threshold and higher score mean more detections and more false alarms. **This setting has never been measured on our audio.**

## Engine vs model

| | sherpa-onnx KWS | openWakeWord |
|---|---|---|
| Engine | C++ streaming transducer runtime with keyword-constrained beam search ("a tiny ASR system" limited to the keyword list). Official WASM build target (`wasm/kws`), which we already compile. | Python package (onnxruntime / ai-edge-litert). Pipeline: melspectrogram ONNX → frozen embedding model (re-implementation of Google `speech_embedding`) → per-phrase classifier. Scores in 0..1 every 80 ms. |
| Model | Zipformer transducer, about 3.3M parameters, 500 BPE units, trained on GigaSpeech XL (10k h English). Open vocabulary: keywords are text and need no retraining. | One small classifier per phrase (e.g. alexa: 3-layer MLP, 102,849 params) on top of the shared backbone. Each phrase is a training artifact. |
| Language | English only (GigaSpeech). A separate zh-en model exists. | English only (TTS-based training). |

## Published accuracy (not comparable to each other)

| Claim | Numbers | Conditions | Source |
|---|---|---|---|
| sherpa/icefall GigaSpeech KWS, **original** model | Recall 86.0% (43/307 missed); 1 FA in about 40 h = **0.025 FA/h** | 20 commands from `open-commands`; negatives from the GigaSpeech test set; threshold not stated; hardware not stated | [icefall RESULTS.md](https://github.com/k2-fsa/icefall/blob/master/egs/gigaspeech/KWS/RESULTS.md), [icefall PR #1428](https://github.com/k2-fsa/icefall/pull/1428) |
| Same model, large set | Recall 83.6% (622/3994 missed); 18 FP; stated **0.45 FA/h** | 200+ commands, "23 h" negatives. Note: 18 FP / 23 h ≈ 0.78/h, so the stated rate does not reconcile. | same |
| Keyword-fine-tuned variant | Recall 98.7% / 97.9%; FA/h 0.6 / 1.3 | Fine-tuned on the target commands. The author says it is worse on keywords outside the fine-tuning set. | same |
| openWakeWord targets | "< 5% FRR, < 0.5 FA/h" at a tuned threshold (described as subjective targets) | FA: Dinner Party Corpus, about 5.5 h. FRR: clean clips plus noise at 5–10 dB SNR and reverb. Default threshold 0.5. | [openWakeWord README](https://github.com/dscripka/openWakeWord) |
| openWakeWord vs Porcupine | "more accurate than Porcupine" for alexa; shown only in plots | Picovoice benchmark clips; the author warns that "sample sizes are small" | README, [docs/models/alexa.md](https://github.com/dscripka/openWakeWord/blob/main/docs/models/alexa.md) |

Caveats:
- I could not confirm whether the released `...3.3M-2024-01-01` sherpa model matches the "original" icefall checkpoint (dated 2024-02-19) or the fine-tuned one. The model page publishes no metrics: [sherpa KWS pretrained models](https://k2-fsa.github.io/sherpa/onnx/kws/pretrained_models/index.html).
- Neither project reports results for "hey dots", for Korean-accented English, for G2 microphones, or for our threshold of 0.1.
- **Any claim that one is "more accurate" for us is unsupported.**

## Latency, CPU, RAM, size

| | sherpa (ours) | openWakeWord |
|---|---|---|
| Detection latency | Not published. Structurally: streaming chunk-16 encoder, plus `numTrailingBlanks: 1` before emit. Our engine estimates cue end as the last token timestamp + 200 ms, and a 2 s ring recovers speech received during decoder latency. Unmeasured on device. | Not published. Structurally: 80 ms frames, a 76-frame mel window into the embedding, 16 embeddings into the classifier. The community port notes about 1.28 s warm-up ([deepcorelabs](https://deepcorelabs.com/open-wake-word-on-the-web/), 2025-07-12, updated 2026-03-30). |
| CPU | Not published for WASM or iPhone | "a single core of a Raspberry Pi 3 can run 15-20 openWakeWord models simultaneously in real-time" (Python, native). Says nothing about WASM or iOS. |
| Model bytes | About 5.25 MB int8 KWS + 0.64 MB VAD | melspectrogram 1.09 MB + embedding 1.33 MB + classifier about 0.2–1.7 MB (+ Silero 1.8 MB optional), per [v0.5.1 assets](https://github.com/dscripka/openWakeWord/releases/tag/v0.5.1) |
| Runtime bytes | `runtime.wasm` 12.8 MB, our KWS/VAD-only build | onnxruntime-web WASM (size depends on version and build; not measured here) |
| RAM | 64–256 MiB WASM heap ceiling (config, not measured) | Unknown |
| Battery | **Unverified for both.** No primary source measures phone battery for either engine. Continuous decode in a WebView worker is the main cost driver; it must be measured. | Same |

## Custom keyword

**sherpa-onnx:**
- Any phrase is written as text and tokenized with the pinned SentencePiece vocabulary.
- No phrase-specific training is needed. The current app uses the fixed name `dots`.
- Accuracy for an arbitrary phrase is untested and may degrade for short or rare words. No measured advantage for the word `dots` was established.
- Fine-tuning on the phrase raised recall in icefall, but it also raised FA/h and hurt other keywords. It requires training infrastructure.

**openWakeWord:**
- Each phrase needs a trained classifier.
- The official automatic notebook ([automatic_model_training.ipynb](https://github.com/dscripka/openWakeWord/blob/main/notebooks/automatic_model_training.ipynb)):
  - Runs on Linux only.
  - Generates positives with Piper `en_US-libritts_r-medium` TTS (LibriTTS-R, CC BY 4.0).
  - Uses precomputed ACAV100M negative features (about 2,000 h) and an 11 h validation set.
- The README recommends several thousand positives. The pretrained models used about 31k h of negatives.
- Per-user custom names would need a trained model per phrase. For our fixed `Hey dots` phrase, this would be a one-time training and evaluation task, not necessarily per-user training.

**Korean speakers saying "Hey dots":**
- Both models are trained on English only.
- sherpa learned from real GigaSpeech audio (podcasts, YouTube, audiobooks).
- openWakeWord learns from US-English TTS voices only, unless we add accented positive data.
- Neither project publishes accented-speech results. Treat this as the largest accuracy risk, and measure it with real Korean speakers.

## Browser / WebView portability

**sherpa-onnx:**
- WASM KWS is a first-class build target in the [repo](https://github.com/k2-fsa/sherpa-onnx/tree/master/wasm).
- We have an implemented worker integration with offline real-model loading and silence tests.
- The iPhone Even Hub WebView still needs physical validation (REFERENCE-WAKE-WORD.md line 7). A desktop Chrome or silent-WASM pass is not proof.

**openWakeWord:**
- The official project has no JS runtime. Its `examples/web` streams mic audio over websockets to a Python server, which would break "phone-local".
- Community ports exist ([openwakeword_wasm](https://github.com/dnavarrom/openwakeword_wasm), npm `openwakeword-web` 0.1.0, deepcorelabs demo) on onnxruntime-web.
- These ports are 0.1.x with no published iOS Safari/WKWebView results. The deepcorelabs write-up confirms Chrome only.
- Porting cost: three-stage buffering, the mel post-transform `(x/10)+2`, and output-buffer copying pitfalls.
- Python/ONNX support does **not** imply that iOS WebView works.

## Licensing and commercial limits

| Component | License | Commercial note |
|---|---|---|
| sherpa-onnx code | Apache-2.0 | OK |
| GigaSpeech KWS model | Our THIRD-PARTY-NOTICES label it Apache-2.0 (with sherpa) | **Unresolved model-license provenance:** the [GigaSpeech dataset](https://huggingface.co/datasets/speechcolab/gigaspeech) describes non-commercial data terms and possible model licensing. Dataset terms alone do not establish the released model's license. Verify the exact checkpoint's redistribution/commercial terms before making a commercial-use claim. |
| Silero VAD | MIT | OK |
| openWakeWord code | Apache-2.0 | OK |
| openWakeWord pretrained models (incl. any "hey_*") | **CC BY-NC-SA 4.0** | Non-commercial. A self-trained "hey dots" classifier avoids this only if every training input permits it: Piper voice is CC BY 4.0; ACAV100M features, AudioSet and FMA terms need separate review. The embedding backbone derives from Google `speech_embedding` (Apache-2.0); confirm the redistributed ONNX file's own license. |

## Maintenance (as of 2026-10-23)

- **sherpa-onnx:**
  - v1.13.8 released 2026-09-10, last push 2026-10-23 (same day as this research), about 15.5k stars.
  - Very active.
  - The KWS models themselves date from 2024-01 (a zh-en KWS model was added 2025-12).
- **openWakeWord:**
  - Last release v0.6.0 on 2024-02-11. Last commit 2025-12-30 (Python 3.10+, ai-edge-litert, training flag).
  - Not archived, about 2.9k stars, 134 open issues.
  - Low-cadence maintenance.

## Recommendation for this app

1. Keep the current sherpa-onnx prototype until a comparable benchmark justifies a switch; this is an integration-cost recommendation, not an accuracy verdict or distribution clearance.
   - It avoids a new browser port and a new `Hey dots` classifier training task. Pretrained-model licensing needs explicit checking for either candidate. The current personal prototype does not require a commercial-use conclusion.
2. Treat `keywordsThreshold 0.1` / `keywordsScore 3` as unvalidated. Tune them with the benchmark below; upstream defaults are 0.25 / 1.
3. Resolve the GigaSpeech model-licensing question before any commercial distribution.
4. Revisit openWakeWord only if the benchmark shows unacceptable FA/h or FRR for "hey dots" that threshold tuning cannot fix.
   - Then the candidate is a self-trained "hey dots" classifier, with licensing-clean data, running in a worker via onnxruntime-web.
   - If runtime-editable names are later requested, evaluate that separately; the current product uses a fixed phrase.

## Reliable benchmark plan (same audio, same device)

An initial small pilot can expose integration failures, but it cannot establish low false-accept rates. The corpus below targets a more credible accuracy comparison.

1. **Audio corpus.** Capture through G2 → app PCM tap (16 kHz mono int16), not a phone mic.
   - **Positives:** ≥ 20 speakers, including ≥ 10 Korean native speakers, × 10 "hey dots" each, at quiet / café noise / walking. Include "hey dots" followed immediately by Korean speech.
   - **Negatives:** ≥ 24 h of everyday G2 audio: Korean conversation, TV/YouTube, music, and the device's own TTS playback. Add confusers: "hey dad", "hey dogs", "pots", "닷츠", "했어".
2. **Offline engine-level pass.** Run both detectors on identical files (sherpa via its CLI or Node WASM; openWakeWord via Python with a self-trained "hey dots" model).
   - Sweep thresholds and plot FRR vs FA/h (DET curves).
   - Report at fixed operating points: FA/h ≤ 0.5 and ≤ 0.1.
   - Record per-detection latency: detection time minus labeled cue end.
3. **On-device pass.** Same build pipeline, on the iPhone in the Even Hub WebView with G2 connected. Replay a fixed 1 h subset plus a 30 min live session.
   - Measure worker CPU time per second of audio, JS heap and WASM memory, cold load time, and battery drain over 60 min against a wake-off baseline. Hold screen and G2 state identical.
4. **Report.** Record device model (read from the device), iOS and Even Hub versions, engine/model versions and hashes, thresholds, and dataset hours. Do not compare numbers taken under different conditions.

## Sources

- https://github.com/k2-fsa/sherpa-onnx (Apache-2.0; release v1.13.8, 2026-09-10)
- https://k2-fsa.github.io/sherpa/onnx/kws/index.html
- https://k2-fsa.github.io/sherpa/onnx/kws/pretrained_models/index.html
- https://github.com/k2-fsa/icefall/blob/master/egs/gigaspeech/KWS/RESULTS.md
- https://github.com/k2-fsa/icefall/pull/1428 (merged 2024-02-22)
- https://huggingface.co/datasets/speechcolab/gigaspeech
- https://github.com/dscripka/openWakeWord (README, FAQ, license)
- https://github.com/dscripka/openWakeWord/blob/main/docs/models/alexa.md
- https://github.com/dscripka/openWakeWord/releases (v0.6.0, 2024-02-11; v0.5.1 asset sizes)
- https://github.com/dscripka/openWakeWord/tree/main/examples/web
- https://github.com/dscripka/openWakeWord/blob/main/notebooks/automatic_model_training.ipynb
- https://huggingface.co/rhasspy/piper-voices (en_US libritts_r medium MODEL_CARD: CC BY 4.0)
- https://deepcorelabs.com/open-wake-word-on-the-web/ (community, not primary)
- https://github.com/dnavarrom/openwakeword_wasm (community, not primary)
