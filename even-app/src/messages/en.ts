import type { SplitMarkers } from "../protocol.ts";
import type { SonioxTranscriptionError } from "../soniox-transcriber.ts";
import type { RequestFailure } from "../voice-flow.ts";
import type { WakeBlocker } from "../wake-gate.ts";

/** What the G2 body says before any reply or notice. */
export interface IdleState {
  restored: boolean;
  connected: boolean;
  transcriber: boolean;
}

/**
 * English UI text, and the shape every other language must match. A function receives only values the app computed;
 * user text and Dot replies are never passed through a catalog.
 */
export const en = {
  /** In the language's own name; the language list itself always shows every autonym. */
  languageShown: "Showing the app in English.",

  // G2 glasses
  idle(state: IdleState, app: string): string {
    if (!state.restored) return `${app} · Checking your saved connection.`;
    if (!state.connected) return `${app} · Connect in the phone app with your server address and connection key.`;
    if (!state.transcriber)
      return `${app} · To ask by voice, add your Soniox key in the phone app. You can also type and send.`;
    return `${app} · Press and hold, ask your question, then let go.`;
  },
  edge(count: number, delta: number): string {
    if (!count) return "No replies yet";
    return delta < 0 ? "This is the first reply" : "This is the last reply";
  },
  splitMarkers: { continues: "\n(continues)", continued: "(continued)\n" } satisfies SplitMarkers,
  captionLive: "Live transcript (not final)",
  captionFinishing: "Finishing transcript · not final · not sent yet",
  wakeBlocked: {
    settings: "Hey dots · Loading settings",
    enabled: "Hey dots off · Microphone off",
    active: "Hey dots paused · Open app on G2",
    ready: "Hey dots · Waiting for G2",
    connected: "Hey dots · Connect in phone app",
    transcriber: "Hey dots · Add Soniox key on phone",
    manual: "Hey dots paused · Manual recording",
    busy: "Hey dots paused · Finishing request",
    draft: "Hey dots paused · Send or clear draft",
  } satisfies Record<WakeBlocker, string>,
  /**
   * The G2 header forms of the microphone notices, keyed like their phone forms. The header holds one line for the
   * reply position, stage, a note and this, so each stays short and always says whether the microphone may be on.
   */
  g2Mic: {
    micOff: "Mic off",
    micTurningOff: "Mic turning off",
    micStopUnconfirmed: "Mic may still be on",
    wakeOffMicOff: "Hey dots off · Mic off",
    wakeNoKeyMicOff: "No Soniox key · Mic off",
    wakePausedMicOff: "Hey dots paused · Mic off",
    wakePreparing: "Hey dots getting ready",
    wakeHeardNow: "Mic on · Hey dots heard",
    wakeStopped: "Hey dots stopped",
    wakeMicStarting: "Mic opening",
    manualMicStarting: "Mic opening",
    micOffProcessing: "Mic off · processing",
    micOnWake: "Mic on · waiting for Hey dots",
    micOnRecording: "Mic on · recording",
    recordingNoSound: "Mic on · recording · no sound yet",
    wakeListeningNoSound: "Mic on · Hey dots · no sound yet",
  },
  /**
   * The bare microphone state of a notice, for a header that also holds a gesture note or a reply stage: on, off,
   * or may be on (turning on or off, or a stop that was not confirmed).
   */
  g2MicCore: { on: "Mic on", off: "Mic off", unsure: "Mic may be on" },

  // Errors from helper modules and transports
  requestFailure(kind: RequestFailure, submission: boolean): string {
    const cause = {
      timeout: "The server did not answer within 45 seconds, so the request was cancelled. Check your network.",
      cancelled: "The app was closed or switched on the glasses, so the server request was cancelled.",
      network: "Could not reach the server. Check your network connection.",
    }[kind];
    return submission
      ? `${cause} It is not known whether the server saved it. If it was saved, the answer is not cancelled and will show here when it arrives.`
      : cause;
  },
  stt(error: SonioxTranscriptionError): string {
    switch (error.kind) {
      case "credential":
        return "This Soniox key can't be used. Enter your key again in settings.";
      case "provider":
        return error.status === 401 || error.status === 403
          ? "Soniox did not accept the key. Check the key in the Soniox Console or replace it with a new one."
          : `Soniox could not transcribe this${error.status === undefined ? "" : ` (code ${error.status})`}. Please try again.`;
      case "timeout":
        return "Soniox took too long to answer. Please try again.";
      case "connection":
        return "Could not reach Soniox. Check your network and try again.";
      case "invalid-audio":
        return "The recording could not be read.";
      case "no-audio":
        return "No sound arrived from the G2 microphone, so nothing was transcribed. Press and hold to speak again.";
      case "protocol":
        return "Soniox sent a reply that could not be read. Please try again.";
      case "aborted":
        return "Transcription was cancelled.";
      case "overflow":
        return "Sending to Soniox fell behind the recording, so it stopped. Check your network and try again.";
    }
  },
  /** The fixed messages helper modules throw (in Korean, see ko.ts), by meaning. */
  thrown: {
    relayOrigin: "Enter only the server's HTTPS address, with nothing after it.",
    pairCode: "Paste the whole 64-character connection key (0-9, a-f) shown in your server dashboard.",
    emptyRecording: "The recording is empty or could not be read.",
    invalidRecording: "The recording could not be read.",
    noSpeech: "No speech was recognized. Please say it again.",
    sonioxKey: "That doesn't look like a Soniox key. Paste the whole key copied from the Soniox Console.",
  },

  /** The static phone page by element id, as shipped in index.html. */
  page: {
    lede: "Ask Dot by voice and read the replies on your glasses.",
    "language-label": "Language",
    "pair-legend": "Connect to your server",
    "origin-label": "Server address (HTTPS)",
    "origin-hint": "Don't add /mcp at the end. /mcp is only for connecting ChatGPT.",
    "dashboard-link-text": "Get a connection key from your dashboard",
    "dashboard-link-note": "(opens in your browser)",
    "copy-dashboard": "Copy dashboard address",
    "dashboard-steps":
      "In the dashboard, sign in, create a connection key (or view your key), and copy it. Then come back here, paste it, and tap Connect.",
    "dashboard-fallback":
      "If the link doesn't open, copy the address below and open it in your phone's browser. To come back, open this screen again from the Even app.",
    "dashboard-address-label": "Dashboard address (press and hold to copy)",
    "code-label": "Connection key",
    "code-hint": "Paste the 64-character connection key you created in your server dashboard.",
    "pair-submit": "Connect",
    disconnect: "Disconnect and forget this connection",
    "soniox-legend": "Voice transcription (your Soniox key)",
    "soniox-get-intro":
      "To ask by voice, you need your own Soniox API key. Sign up or sign in at the Soniox Console, create an API key, then paste it below.",
    "soniox-console-text": "Get a Soniox API key",
    "soniox-console-note": "(opens the Soniox Console in your browser)",
    "soniox-privacy":
      "Your voice goes straight from this phone to Soniox to become text, and only that text is sent to your server. Your key and your audio never reach the server. For safety, create a separate key in the Soniox Console just for this app.",
    "soniox-key-label": "Soniox API key",
    "soniox-remember-text": "Remember the key on this phone",
    "soniox-remember-hint":
      "When off, the key is kept only until you close the app. Changing this while a key is set saves or removes it right away. The key is kept in Even app storage, which may not be encrypted.",
    "soniox-apply": "Use this key",
    "soniox-clear": "Remove key",
    voice: "Ask Dot",
    "voice-note":
      "On G2, press and hold, speak, then let go. What you said is turned into text and sent to Dot automatically. Up to 30 seconds; needs a Soniox key.",
    "auto-send-text": "Send automatically after transcription (turn off to review before sending)",
    "wake-text": "Hey dots hands-free voice (on by default; uses the G2 microphone while the app is open on G2)",
    "wake-hint":
      "The G2 microphone opens only when G2 is ready, you are connected, and a Soniox key is set. This phone listens for the wake word itself, while the app is open on G2, and keeps listening and checking for replies even if the phone screen turns off or locks; the Even app and your phone's background limits may affect this. The phone's own microphone is not used. Say Hey dots (English pronunciation), then your question: only the question after it is transcribed by Soniox and sent to your server as text. If it doesn't respond, press and hold to speak instead. Turning this off stops listening right away.",
    record: "Start recording",
    stop: "Stop and transcribe",
    "text-label": "Message (you can type instead of speaking)",
    send: "Send to Dot",
    "reply-title": "Replies from Dot",
    "prev-message": "Previous message",
    "next-message": "Next message",
    prev: "Previous part on G2",
    next: "Next part on G2",
    "help-title": "Help and feedback",
    "help-note":
      "The project's GitHub page has the usage guide and source. Ask questions or request features in GitHub Issues.",
    "guide-link-text": "Usage guide and source",
    "guide-link-note": "(opens GitHub in your browser)",
    "help-link-text": "Questions and feature requests",
    "help-link-note": "(opens GitHub in your browser)",
  },
  /** Starting page text that stays until the app writes something in its place. */
  placeholders: {
    status: "Checking the Even app connection",
    reply: "Waiting for a reply.",
    display: "Not shown on G2 yet",
  },

  // Runtime phone and G2 notices
  afterConnecting: "After connecting, press and hold and speak.",
  micStopUnconfirmed:
    "The microphone may still be on. Press and hold to try again, or close the app from the Even app.",
  settingsUnread:
    "Couldn't load your saved voice settings, so Hey dots and automatic sending are off. Turn them back on if you like.",
  micOff: "Microphone off",
  draftPausesRecording: "You have an unsent message, so recording is paused. Send or clear it first.",
  noSonioxKey: "Add your Soniox key in settings to ask by voice. You can also type your message and send it.",
  keyRemovalUnconfirmed:
    "The key is cleared here, but removal from Even app storage wasn't confirmed. Tap Remove key again.",
  keySessionOnlyOldMayRemain:
    "The key works for this session only. A key remembered earlier may still be stored, because the change to Even app storage wasn't confirmed.",
  keyRemembered: "Soniox key set · remembered on this phone in Even app storage until you remove it.",
  keySessionOnly: "Soniox key set · kept only until you close the app.",
  recordingNoSound: "Recording · no sound from G2 yet · keep speaking and it will be picked up.",
  wakeListeningNoSound: "Hey dots listening · no sound from G2 yet · this can be normal when it's quiet.",
  micTurningOff: "Turning the microphone off",
  wakeOffMicOff: "Hey dots off · microphone off",
  wakeNoKeyMicOff: "Hey dots unavailable · no Soniox key · microphone off",
  wakePausedMicOff: "Hey dots paused · microphone off",
  wakePreparing: "Getting Hey dots ready on this phone",
  wakeHeardNow: "Hey dots heard · ask your question now.",
  wakeHeard: "Hey dots heard · ask your question.",
  readyForQuestion: "Ready for your question. Say Hey dots or press and hold to speak.",
  wakeStopped: "Hey dots stopped listening. Press and hold to speak, or type your message.",
  micStartFailed: "Couldn't turn on the G2 microphone.",
  wakeMicStarting: "G2 microphone turning on · waiting for sound",
  historyDeleted:
    "Your conversation history was deleted, so its replies are gone from this phone too. Anything you were typing is kept, and you can ask a new question.",
  historyExpired: "Replies older than the keep period were removed from this phone too.",
  ackPending: "final answer coming",
  ackLabel: "Interim reply",
  finalLabel: "Final answer",
  somethingWrong: "Something went wrong.",
  waitingEvenApp: "Waiting for the Even app.",
  preparingG2: "Getting the G2 screen ready.",
  loadingSettings: "Loading your saved voice settings.",
  connectToRecord: "Connect to your server to record.",
  sonioxToRecord: "Add a Soniox key to record. You can still type your message below and send it.",
  finishingPrevious: "Finishing the previous request.",
  messagePosition: (index: number, count: number, stage: string) =>
    `Message ${index} of ${count}${stage ? ` · ${stage}` : ""}`,
  noMessages: "No messages yet.",
  connectFirst: "Connect to your server first.",
  connectionExpired: "This connection has expired. Disconnect, then connect again with a new connection key.",
  questionRejected:
    "The server didn't take this question because the conversation was deleted or passed its keep period. It won't be resent automatically; sending again sends it as a new question.",
  serverFailed: (status: number) => `Server request failed (${status})`,
  g2NotConnected: "G2 not connected yet · you can read here on your phone.",
  showingOnG2: "Showing on G2…",
  g2UpdateFailed: "Couldn't update G2 · read the reply here on your phone.",
  showingLiveCaption: "Showing the live transcript (not final) on G2",
  shownOnG2: "Shown on G2.",
  g2Unconfirmed: "Couldn't confirm that G2 was updated.",
  replyPosition: (index: number, count: number) => `${index}/${count}`,
  voiceStopped: "Voice input stopped · nothing was sent.",
  replyBackToReading:
    "Dot replied · going back to the message you were reading. Move to the next message to see the new reply.",
  replyShowingLatest: "Dot replied · showing the latest reply on G2.",
  exitFailed: "Couldn't close · double-tap",
  exitRequestFailed: "Couldn't ask G2 to close the app. Double-tap again, or close it from the Even app.",
  staleResponse: "Skipped an outdated server response that is older than the conversation already shown.",
  unversionedResponse:
    "Skipped a server response without a conversation version, because it could include deleted replies.",
  erasedReplyAfterVoice: (erased: string) => `${erased} The new reply will show on G2 after your voice input is sent.`,
  replyAfterVoice: "Dot replied · it will show on G2 after your voice input is sent.",
  erasedShowingNew: (erased: string) => `${erased} Showing the new reply.`,
  ackReceived: "Dot interim reply received · final answer coming · showing it on G2.",
  finalReceived: "Dot final answer received · showing it on G2. The interim reply stays in the previous message.",
  replyShowing: "Dot replied · showing it on G2.",
  finishingTranscriptWaiting: "Finishing your transcript · waiting for the final text",
  finishingTranscript: "Finishing your transcript · not sent yet",
  transcriptReady: "Transcript ready · check it, then send.",
  transcriptAppended: "Transcript ready · added after what you were typing. Check it, then send.",
  transcriptReadyPhone: "Transcript ready · check it on your phone, then send.",
  sendUnconfirmed: "Couldn't confirm whether it was sent.",
  sendFailed: "Couldn't send.",
  transcriptKept: (reason: string) => `${reason} Your transcript is kept in the message box. Check it and send again.`,
  manualMicStarting: "G2 microphone turning on · waiting for your voice",
  recordingLive: "Recording · turning your voice into text as you speak · stop to send the final text.",
  recordingHold: "Recording · let go to transcribe and send.",
  micOffProcessing: "Microphone off · processing your voice",
  settingsSaveFailed:
    "Couldn't save your settings. They apply now, but the next launch may use your previous settings.",
  sending: "Sending to your server · not confirmed yet",
  delivered: "Saved and delivered to Dot · waiting for a reply.",
  savedNotDelivered: "Saved on your server · Dot hasn't confirmed it or replied yet.",
  savedThenDeleted:
    "Your server got the question, but the conversation was deleted meanwhile, so this question may be gone too.",
  replyReady: "A reply is ready · loading it.",
  messageKept: (reason: string) => `${reason} Your message is still in the message box.`,
  dashboardNeedsOrigin: "To open the dashboard, enter your server's HTTPS address with nothing after it.",
  dashboardCopied: "Dashboard address copied. Open it in your phone's browser.",
  dashboardCopyFailed: "Couldn't copy. Press and hold the dashboard address above to copy it.",
  languageSaveFailed:
    "Couldn't save your language choice. It applies now, but the next launch may show another language.",
  originInvalid: "That server address isn't valid. Enter an address that starts with https://.",
  connecting: "Connecting to your server",
  connectTimeout: "The server didn't answer within 15 seconds. Check the address and your network.",
  connectNetwork: "Couldn't reach the server. Check the address and your network.",
  keyRejected: (status: number) =>
    `That connection key is wrong or has expired (${status}). Get a new key and enter it again.`,
  connectFailed: (status: number) => `Couldn't connect to the server (${status}) · please try again shortly.`,
  connectIncomplete: "The server didn't complete the connection.",
  connectSaveFailed: "Couldn't save the connection. Connect again with a new connection key.",
  connected: "Connected to your server · finish connecting and subscribing in Dot too.",
  connectFailedGeneric: "Couldn't connect.",
  previousConnectionKept: (message: string) => `${message} Your previous connection is kept.`,
  keyFailed: "Couldn't use this key.",
  waitForEvenApp: "Wait until the Even app is connected, then enter your key.",
  keySaving: "Saving your key",
  keyUpdating: "Updating where your key is kept",
  keyRemoving: "Removing your key",
  disconnected: "Disconnected.",
  connectionForgotten:
    "This phone forgot the connection. Remove the device on your server too to revoke it completely.",
  forgetUnconfirmed: "Couldn't confirm that the saved connection was removed. Check the Even app's stored data.",
  voiceStoppedAppSwitch:
    "Voice input stopped because you switched apps on G2. Say Hey dots or press and hold to speak again.",
  pageHidden:
    "The page was closed or hidden, so listening, recording and reply checks stopped. They continue when the page is back.",
  pageBack: "The page is back · listening and reply checks continue.",
  evenAppMissing: (app: string) => `Couldn't find the Even app. Open ${app} from the Even app.`,
  g2StartFailed: "Couldn't start the G2 screen. Open the app again from the Even app.",
  micOnWake: "Microphone on · listening for Hey dots on this phone · nothing is sent before you say it.",
  micOnRecording: "Microphone on · recording",
  badAudioFrame: "Received sound that couldn't be read.",
  abnormalExit:
    "The app closed unexpectedly on G2, so listening, recording and reply checks stopped. Open it again from the Even app.",
  systemExit:
    "The app was closed on G2, so listening, recording and reply checks stopped. Open it on G2 to use it again.",
  foregroundExit:
    "You switched apps on G2, so listening, recording and reply checks stopped. They continue when you open it on G2 again.",
  foregroundBack: "Back on G2 · listening and reply checks start again.",
  keyLoadFailed: "Couldn't load your saved Soniox key. Enter it again, or tap Remove key.",
  savedConnectionUnreadable: "Your saved connection couldn't be read. Connect with a new connection key.",
  usingSavedConnection: "Using your saved server connection.",
  g2ReadyEnterConnection: "G2 ready · enter your server address and connection key.",
};

export type Messages = typeof en;
