# Short physical phone/G2 release smoke

No physical hardware was controlled or verified by this task. Simulator captures are layout evidence only.

1. In the phone Even app, Me → Apps → Private builds, install/open **Lens MCP for G2 0.4.1**. Confirm that exact version and pair through the existing flow. Send a harmless typed sentence from the phone. For its correlated reply, record server/phone receipt and SDK acknowledgement times separately; the wearer must read the actual G2 text to establish physical display. Reopen/resume once and confirm the same reply can be read; SDK acknowledgement alone is insufficient.
2. With the owner's existing Soniox key, hold/release G2 for one short Korean question. Confirm transcript, single submission and correlated response on both phone and glasses. Repeat one Hey dots cue and switch wake off to confirm listening stops. Do not include secrets or private content in screenshots/logs.
3. Double-tap G2: system exit dialog appears. Cancel and confirm the session still works; double-tap again and confirm exit. Verify the phone WebView closes and Conversate launches without restarting glasses.
4. **Only after separately authorized beta promotion/tester access:** install as Beta, lock the phone for five minutes, ask/receive from glasses, leave idle two minutes, unlock/use another app/re-lock and repeat. Observe wake behavior and battery/microphone state. Repeat one round trip with Mac off. Private/QR/simulator results must not be substituted for official Beta lock-state QA.

Expected release gates: physical response display and measured latency; Korean voice; cancellation/exit; locked beta operation. Current 2.5-second serialized poll interval and 1.2-second wake silence endpoint are source timings, not measured end-to-end latency.
