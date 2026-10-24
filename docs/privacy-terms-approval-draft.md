# Lens MCP for G2 — privacy notice and terms approval draft

**LOCAL DRAFT — NOT PUBLISHED, NOT LEGALLY REVIEWED, NOT APPROVED FOR PUBLIC USE.** Prepared 2026-10-23, updated 2026-10-24 for the local 0.5.0 candidate (source base `a266438` plus uncommitted backend and companion changes whose final review is pending). Current production is Even Hub 0.4.2 (Private build) with a relay that does not yet include the retention and deletion behavior described here. The owner approved the 30-day retention and owner-erase requirement and the iPhone + G2 target. Public developer/operator display name and support/privacy email are approved as recorded below. Policy URL, effective date, phone/address and legal approval remain unresolved; their placeholders must stay visibly unfilled until approved.

> **Version note.** Sections marked *0.5.0 candidate* describe behavior that is implemented locally but not deployed or uploaded. Until 0.5.0 is deployed and verified, the production relay keeps conversations with no retention period and no user-facing deletion. Do not publish this notice for production 0.4.2 without that caveat.

## Privacy notice — current implementation

### Operator and service

Operator public display name: **keenranger**. Support/privacy contact: **kghnkl0103@gmail.com**. Approved for public use on 2026-10-24; this does not identify a legal personal name or validate mailbox operation. Portal telephone and address: not to be filled until it is confirmed whether the portal shows them publicly.

Lens MCP for G2 is an independent companion connecting the user's ChatGPT Dot through MCP to G2 glasses. It is not an official Even Realities product and is not a general-purpose MCP client. The phone hosts the companion. Setup uses a one-time relay pairing code; voice transcription additionally uses the user's Soniox account/key.

### Information processed and why

- **Microphone audio:** manual hold/release captures up to 30 seconds. After pairing and a speech key are configured, Hey dots is enabled by default and can be switched off. In the 0.5.0 candidate an explicit OFF/ON choice is remembered on the phone, and a saved OFF keeps the microphone closed during startup; in production 0.4.2 Hey dots is on again at each launch. Missing G2 audio frames are only reported on screen ("G2 오디오 수신 확인 안 됨"); they never cause the app to close, reopen or discard a capture on its own. Cue detection runs locally on the phone. Pre-cue audio is held in bounded local buffers, is not submitted to the relay or speech provider by the wake path, and is cleared on cancellation. Post-cue speech or manually captured audio goes directly from the phone to Soniox over WSS for transcription. The companion does not upload raw audio to the relay, and the relay's server-side transcription endpoint is disabled: it has no server credential and rejects requests before reading any audio. Soniox's handling of received audio is governed by the user's provider relationship; this app does not control or promise its deletion.
- **Text and replies:** typed messages, final transcripts and Dot replies are sent to the paired relay to route the conversation through ChatGPT/MCP and return replies to the phone and G2. The relay stores text, owner-linked identifiers, message/utterance/device identifiers, timestamps and delivery/retry state. In the 0.5.0 candidate it also stores a per-owner conversation revision counter and, after an owner erase or physical sweep, text-free tombstones holding only owner-linked record identifiers and a timestamp, with no message content. Message content can contain personal information the user chooses to include.
- **Proactive agent messages:** the connected agent can send messages that are not replies to a specific utterance. These are stored on the relay without a device identifier and are delivered to every paired device of the same owner.
- **Connection records:** the relay stores pairing-code and device-token hashes, device identifiers/creation time, owner-linked subscriptions, callback URLs/signing secrets and rate-limit counters for pairing, authentication, routing and abuse control. Callback secrets stay server-side; they are not included in the distributable app.
- **Phone storage:** the device bearer token and relay origin are saved through Even Hub SDK local storage. Soniox keys remain in session memory by default; only the user's explicit remember-on-device option saves the key through SDK storage. Clearing/replacing the key controls that app-managed copy. The app does not add encryption at rest or promise how the Even app/OS stores SDK values. Up to 100 deduplicated replies are kept in the phone UI's in-memory history. In the 0.5.0 candidate the Hey dots and voice auto-send choices are saved through SDK storage; the Soniox key is never written by that code.
- **Sign-in:** relay owner authorization uses trusted Sites/ChatGPT identity. Browser owner/session credentials are not copied into the companion. Platform account/session processing is managed by those platform providers.

### Destinations and service providers

1. Paired relay: `https://hey-dots-g2.keenranger.chatgpt.site`, using the hosted Sites/Cloudflare Worker and D1 infrastructure configured by this project. It receives text and connection/routing data, not raw microphone audio or the Soniox key.
2. Soniox: `wss://stt-rt.soniox.com` for direct speech transcription using the user's key. The network whitelist also includes the corresponding HTTPS origin. Soniox receives the audio submitted for transcription and the authentication needed for the user's account.
3. ChatGPT/Dot and its registered MCP callback destination: receives submitted conversation text and returns replies. ChatGPT/provider account policies govern their processing.
4. Even Realities app/OS: hosts the companion and mediates glasses microphone/display and SDK local storage.

Provider locations, infrastructure/access logs, backups and provider-side retention have not been audited by this project. This draft makes no promises about their deletion, geographic residency or absence. No additional analytics vendor is asserted here.

### Retention and deletion

**Production 0.4.2 (current):** the relay has no automatic conversation retention period and no user-facing conversation deletion. Stored questions, transcripts, replies and proactive messages may remain indefinitely. Do not include sensitive conversations unless you accept this.

**0.5.0 candidate (owner-approved requirement, implemented locally, not deployed):**

- **30-day cutoff.** A conversation record is no longer shown, delivered, retried or answerable once 30 days have passed since its creation time, measured in UTC (`createdAt <= now - 30 days`). This applies to questions, transcripts, replies, proactive messages, records of revoked devices and older records alike. It applies whether or not the record has yet been physically removed from the database.
- **Erase now.** The signed-in owner can erase all of their conversations at once from the relay dashboard. The erase takes effect immediately on the relay: content is deleted in one transaction, text-free tombstones (no message content) prevent late retries from re-storing erased items, and a revision counter tells the companion to clear its cached replies on its next active poll. Paired devices, the Dot subscription and pairing are kept.
- **Physical cleanup.** A daily cleanup at 03:00 Asia/Seoul is intended but **not yet activated**. Once activated and healthy, records past the 30-day cutoff are expected to be physically removed within up to 24 hours after the cutoff; failed runs or a backlog larger than one run can handle (a run targets up to 20,000 records) add further delay. This notice does not promise physical deletion on exactly day 30, and automatic physical deletion must not be described as live until the schedule is activated and verified.
- **Limits.** The relay cannot erase content already sent to ChatGPT (Dot) or Soniox, or already displayed on the phone or glasses. Provider-side copies, infrastructure/access logs and backups are outside this commitment and have not been audited.

**Both versions:** returning only the latest 100 replies is a query/UI limit, not a deletion policy. Revoking a paired device deletes its authentication record and prevents subsequent token use; it is not conversation deletion, and that device's past utterances and messages remain stored under the owner until erased or past the cutoff (0.5.0 candidate). Disconnecting the companion clears the locally stored device connection, not the relay's stored conversations.

Pairing codes are usable for 10 minutes and consumed atomically on successful use. Subscriptions have a validity TTL (default one hour, bounded between one minute and one day) and can be explicitly unsubscribed, which deletes the subscription record. Expiration makes records unusable for that operation; no scheduled job purges expired pairing, subscription or rate-limit rows. Rate limits use one-minute validity windows, which likewise do not establish a database deletion schedule.

The approved privacy contact is kghnkl0103@gmail.com; its operation must still be verified before this notice is published; no response deadline is promised by this draft.

### User controls and session behavior

Users can switch Hey dots off, stop recording, clear or replace their Soniox key, opt out of remembering it, disconnect the companion, and revoke a paired device through the relay dashboard, and (0.5.0 candidate) erase all conversations from the dashboard. Voice auto-send is on by default and can be disabled to review the transcript; typed messages require explicit send. In the 0.5.0 candidate the Hey dots and auto-send choices are remembered on the phone; in production 0.4.2 they are not. Persistence across an Even app relaunch has not yet been verified on a device. Soniox sessions may incur the user's provider charges.

A ready glasses session may continue with the phone locked or the Even app in the background while the host WebView remains alive; this is intended behavior. Hey dots may therefore continue using the glasses microphone in that state. Page unload, host exit, disconnection and relevant cancellation paths stop session operations. Phone OS suspension can stop execution; session-only state can be lost. Locked-phone behavior and physical G2 display are awaiting beta-device verification.

### Security and evidence limits

The app uses HTTPS/WSS endpoints, device-scoped bearer authentication, owner-scoped relay operations, hashed pairing/token lookup, bounded audio buffering and request limits. These measures are not a guarantee of absolute security or encrypted local storage. Server storage or an SDK update acknowledgement does not establish that text was physically visible on G2.

## Terms of use — approval draft

1. **Scope:** Lens MCP for G2 provides the independent ChatGPT Dot connection described above. It does not promise compatibility with every MCP server/agent. It requires compatible G2/Even app software, a phone, network access, the user's connected ChatGPT Dot and, for speech, the user's Soniox account/key.
2. **User accounts and provider charges:** users control the accounts and keys they supply and must be entitled to use them. Third-party provider terms and charges apply separately. The app does not create provider accounts or include paid transcription credit.
3. **Operation and limitations:** transcription may contain mistakes; generated replies may be incorrect. Review outputs before relying on them. Do not use this companion for emergencies or as a substitute for professional medical, legal or financial advice. Interact with glasses only when it is safe. Background availability depends on the host app/OS and is not guaranteed. No physical runtime success is established by simulator output.
4. **Privacy:** the approved privacy notice must accompany these terms. In production 0.4.2, relay conversations have no automatic deletion period or self-service deletion. The 0.5.0 candidate adds a 30-day cutoff and an owner erase control as described in the notice; physical cleanup timing is not guaranteed to the day, and provider copies are outside the relay's control. Device revocation is not conversation deletion.
5. **Access and exit:** users can stop microphone use, remove keys, disconnect and revoke the device connection using the controls described above. Other provider accounts and stored provider data remain subject to those providers' controls.
6. **Independence:** this companion is not affiliated with or endorsed by Even Realities, OpenAI/ChatGPT or Soniox merely because it interoperates with their products. Provider names identify compatibility/services, not a sponsorship claim.
7. **Support and legal administration:** public developer keenranger; support/privacy contact kghnkl0103@gmail.com (approved 2026-10-24), [effective date], [applicable legal/jurisdiction wording if needed], [approved change-notice/support process]. The effective date, legal wording and support process remain unresolved; no waiver, liability allocation, cancellation contract or governing law is adopted by this draft.

## Owner decisions

Settled (do not re-ask):

- Retention requirement: 30-day UTC read/delivery cutoff plus immediate owner erase, approved by the owner. Implemented in the local 0.5.0 candidate; deployment, schedule activation and publishing each need separate authorization.
- Target platform: iPhone + G2.
- Default-on Hey dots, including while the phone is locked or the Even app is backgrounded, is explicitly desired. The explicit OFF/ON choice is remembered (0.5.0 candidate).
- The Soniox key is session-only by default, with explicit remember-on-device opt-in.

Still open:

- Public identity/contact settled on 2026-10-24: keenranger / kghnkl0103@gmail.com. Publication and operational mailbox validation remain separate.
- Whether the portal's telephone and address fields are shown publicly; leave them empty until confirmed.
- Final policy/terms text, legal review, public hosting destination, effective date and any legal provisions before publishing. Do not fill portal fields with unapproved promises or placeholder URLs.

### Candidate retention clarification — DRAFT

Physical sweeps delete expired conversation content and atomically leave owner-scoped, text-free ID fences (identifiers and sweep timestamp only). These fences reject same-ID retries with `410` for 30 further days from the sweep, then expire without replacement. This is bounded retry protection, not a permanent ID guarantee.

Each maintenance invocation targets at most 20,000 rows and uses at most 41 SQL statements including rate limiting. Fence insertion and later deletion add metadata storage and index writes; hosted D1 plan, quota, actual rows written and batch-result behavior remain unverified activation gates. Measure the first hosted sweep before activating the intended daily 03:00 Asia/Seoul cleanup. The schedule remains unactivated.

Public identity/contact are approved: keenranger / kghnkl0103@gmail.com (2026-10-24). Effective date, hosting, phone/address, legal provisions and policy text remain DRAFT and require approval. No policy approval, hosting, schedule activation or public readiness is established.
