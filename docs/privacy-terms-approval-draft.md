# Lens MCP for G2 — privacy notice and terms approval draft

**LOCAL DRAFT — NOT PUBLISHED OR ACCEPTED.** Prepared 2026-10-23 for source/build 0.4.1. Operator name, public support contact, policy URL, effective date and final approval are unresolved. This document describes the current implementation; it does not adopt the proposed 30-day policy.

## Privacy notice — current implementation

### Operator and service

Operator: [owner must approve public identity]. Support/privacy contact: [owner must approve public contact].

Lens MCP for G2 is an independent companion connecting the user's ChatGPT Dot through MCP to G2 glasses. It is not an official Even Realities product and is not a general-purpose MCP client. The phone hosts the companion. Setup uses a one-time relay pairing code; voice transcription additionally uses the user's Soniox account/key.

### Information processed and why

- **Microphone audio:** manual hold/release captures up to 30 seconds. After pairing and a speech key are configured, Hey dots is enabled by default and can be switched off. Cue detection runs locally on the phone. Pre-cue audio is held in bounded local buffers, is not submitted to the relay or speech provider by the wake path, and is cleared on cancellation. Post-cue speech or manually captured audio goes directly from the phone to Soniox over WSS for transcription. The companion does not upload raw audio to the relay. Soniox's handling of received audio is governed by the user's provider relationship; this app does not control or promise its deletion.
- **Text and replies:** typed messages, final transcripts and Dot replies are sent to the paired relay to route the conversation through ChatGPT/MCP and return replies to the phone and G2. The relay stores text, owner-linked identifiers, message/utterance/device identifiers, timestamps and delivery/retry state. Message content can contain personal information the user chooses to include.
- **Connection records:** the relay stores pairing-code and device-token hashes, device identifiers/creation time, owner-linked subscriptions, callback URLs/signing secrets and rate-limit counters for pairing, authentication, routing and abuse control. Callback secrets stay server-side; they are not included in the distributable app.
- **Phone storage:** the device bearer token and relay origin are saved through Even Hub SDK local storage. Soniox keys remain in session memory by default; only the user's remember-on-device option saves the key through SDK storage. Clearing/replacing the key controls that app-managed copy. The app does not add encryption at rest or promise how the Even app/OS stores SDK values. Up to 100 deduplicated replies are kept in the phone UI's in-memory history.
- **Sign-in:** relay owner authorization uses trusted Sites/ChatGPT identity. Browser owner/session credentials are not copied into the companion. Platform account/session processing is managed by those platform providers.

### Destinations and service providers

1. Paired relay: `https://hey-dots-g2.keenranger.chatgpt.site`, using the hosted Sites/Cloudflare Worker and D1 infrastructure configured by this project. It receives text and connection/routing data, not raw microphone audio or the Soniox key.
2. Soniox: `wss://stt-rt.soniox.com` for direct speech transcription using the user's key. The network whitelist also includes the corresponding HTTPS origin. Soniox receives the audio submitted for transcription and the authentication needed for the user's account.
3. ChatGPT/Dot and its registered MCP callback destination: receives submitted conversation text and returns replies. ChatGPT/provider account policies govern their processing.
4. Even Realities app/OS: hosts the companion and mediates glasses microphone/display and SDK local storage.

Provider locations, infrastructure/access logs, backups and provider-side retention have not been audited by this project. This draft makes no promises about their deletion, geographic residency or absence. No additional analytics vendor is asserted here.

### Retention and deletion — important current limitation

**The relay currently has no automatic conversation retention period and no user-facing conversation deletion function. Stored questions, transcripts and replies may remain indefinitely.** Returning only the latest 100 replies is a query/UI limit, not a deletion policy. Revoking a paired device deletes its authentication record and prevents subsequent token use; it does not erase conversation records. Disconnecting the companion clears the locally stored device connection, not the relay's stored conversations.

Pairing codes are usable for 10 minutes and consumed atomically on successful use. Subscriptions have a validity TTL (default one hour, bounded between one minute and one day) and can be explicitly unsubscribed. Expiration makes records unusable for that operation; automatic physical purging of expired records is not implemented/verified. Rate limits use one-minute validity windows, which likewise do not establish a database deletion schedule.

Do not include sensitive conversations unless you accept this current retention limitation. A contact route for privacy requests must be approved and made operational before this notice is published; no response deadline or deletion capability is promised by this draft.

### User controls and session behavior

Users can switch Hey dots off, stop recording, clear or replace their Soniox key, opt out of remembering it, disconnect the companion, and revoke a paired device through the relay dashboard. Voice auto-send can be disabled to review the transcript; typed messages require explicit send. Soniox sessions may incur the user's provider charges.

A ready glasses session may continue with the phone locked while the host WebView remains alive. Hey dots may therefore continue using the glasses microphone in that state. Page unload, host exit, disconnection and relevant cancellation paths stop session operations. Phone OS suspension can stop execution; session-only state can be lost. Locked-phone behavior and physical G2 display are awaiting beta-device verification.

### Security and evidence limits

The app uses HTTPS/WSS endpoints, device-scoped bearer authentication, owner-scoped relay operations, hashed pairing/token lookup, bounded audio buffering and request limits. These measures are not a guarantee of absolute security or encrypted local storage. Server storage or an SDK update acknowledgement does not establish that text was physically visible on G2.

## Terms of use — approval draft

1. **Scope:** Lens MCP for G2 provides the independent ChatGPT Dot connection described above. It does not promise compatibility with every MCP server/agent. It requires compatible G2/Even app software, a phone, network access, the user's connected ChatGPT Dot and, for speech, the user's Soniox account/key.
2. **User accounts and provider charges:** users control the accounts and keys they supply and must be entitled to use them. Third-party provider terms and charges apply separately. The app does not create provider accounts or include paid transcription credit.
3. **Operation and limitations:** transcription may contain mistakes; generated replies may be incorrect. Review outputs before relying on them. Do not use this companion for emergencies or as a substitute for professional medical, legal or financial advice. Interact with glasses only when it is safe. Background availability depends on the host app/OS and is not guaranteed. No physical runtime success is established by simulator output.
4. **Privacy:** the approved privacy notice must accompany these terms. Current relay conversations have no automatic deletion period or self-service conversation deletion; device revocation is not conversation deletion. Do not supply content whose retention you cannot accept.
5. **Access and exit:** users can stop microphone use, remove keys, disconnect and revoke the device connection using the controls described above. Other provider accounts and stored provider data remain subject to those providers' controls.
6. **Independence:** this companion is not affiliated with or endorsed by Even Realities, OpenAI/ChatGPT or Soniox merely because it interoperates with their products. Provider names identify compatibility/services, not a sponsorship claim.
7. **Support and legal administration:** [approved operator/contact], [effective date], [applicable legal/jurisdiction wording if needed], [approved change-notice/support process]. These are unresolved; no waiver, liability allocation, cancellation contract or governing law is adopted by this draft.

## Owner approval choices — separate from existing behavior

- Approve public operator identity and support/privacy contact; parent is awaiting the user's answer. Do not insert or publish personal details before approval.
- Approve a truthful current-retention notice, or separately authorize and implement a retention/deletion design first. **Proposed, not implemented:** 30-day automatic conversation deletion plus user-triggered conversation deletion. Do not describe either as available today. Any design must define affected rows, backups/provider limits and user isolation.
- Decide whether default-on Hey dots while a live glasses session is locked is acceptable, or request an opt-in/default change separately. This draft does not authorize a behavior change.
- Approve final policy/terms text, public hosting destination and any legal provisions before publishing. Do not fill portal fields with unapproved promises or placeholder URLs.
