import type { Messages } from "./en.ts";

/** Simplified Chinese. */
export const zh: Messages = {
  languageShown: "应用现以简体中文显示。",

  idle(state, app) {
    if (!state.restored) return `${app} · 正在检查已保存的连接。`;
    if (!state.connected) return `${app} · 请在手机应用中输入服务器地址和连接密钥进行连接。`;
    if (!state.transcriber) return `${app} · 如需语音提问，请在手机应用中添加您的 Soniox 密钥。也可以直接输入并发送。`;
    return `${app} · 长按并说出问题，然后松开。`;
  },
  edge(count, delta) {
    if (!count) return "暂无回复";
    return delta < 0 ? "这是第一条回复" : "这是最后一条回复";
  },
  splitMarkers: { continues: "\n（未完）", continued: "（接上）\n" },
  captionLive: "实时转写（未定稿）",
  captionFinishing: "正在完成转写 · 未定稿 · 尚未发送",
  wakeBlocked: {
    settings: "Hey dots · 正在加载设置",
    enabled: "Hey dots 已关闭 · 麦克风关闭",
    active: "Hey dots 已暂停 · 请在 G2 上打开应用",
    ready: "Hey dots · 正在等待 G2",
    connected: "Hey dots · 请在手机应用中连接",
    transcriber: "Hey dots · 请在手机上添加 Soniox 密钥",
    manual: "Hey dots 已暂停 · 正在手动录音",
    busy: "Hey dots 已暂停 · 正在完成请求",
    draft: "Hey dots 已暂停 · 请发送或清除草稿",
  },
  g2Mic: {
    micOff: "麦克风关闭",
    micTurningOff: "正在关闭麦克风",
    micStopUnconfirmed: "麦克风可能仍开启",
    wakeOffMicOff: "Hey dots 已关闭 · 麦克风关闭",
    wakeNoKeyMicOff: "没有 Soniox 密钥 · 麦克风关闭",
    wakePausedMicOff: "Hey dots 已暂停 · 麦克风关闭",
    wakePreparing: "正在准备 Hey dots",
    wakeHeardNow: "麦克风开启 · 已听到 Hey dots",
    wakeStopped: "Hey dots 已停止",
    wakeMicStarting: "正在打开麦克风",
    manualMicStarting: "正在打开麦克风",
    micOffProcessing: "麦克风关闭 · 正在处理",
    micOnWake: "麦克风开启 · 等待 Hey dots",
    micOnRecording: "麦克风开启 · 正在录音",
    recordingNoSound: "麦克风开启 · 正在录音 · 尚无声音",
    wakeListeningNoSound: "麦克风开启 · Hey dots · 尚无声音",
  },
  g2MicCore: { on: "麦克风开启", off: "麦克风关闭", unsure: "麦克风可能开启" },

  requestFailure(kind, submission) {
    const cause = {
      timeout: "服务器在 45 秒内没有响应，请求已取消。请检查网络。",
      cancelled: "眼镜上的应用已关闭或切换，服务器请求已取消。",
      network: "无法连接服务器。请检查网络连接。",
    }[kind];
    return submission ? `${cause}无法确定服务器是否已保存。如果已保存，回复不会被取消，到达后会显示在这里。` : cause;
  },
  stt(error) {
    switch (error.kind) {
      case "credential":
        return "此 Soniox 密钥无法使用。请在设置中重新输入密钥。";
      case "provider":
        return error.status === 401 || error.status === 403
          ? "Soniox 未接受该密钥。请在 Soniox Console 中检查密钥，或换用新密钥。"
          : `Soniox 无法转写此内容${error.status === undefined ? "" : `（代码 ${error.status}）`}。请重试。`;
      case "timeout":
        return "Soniox 响应超时。请重试。";
      case "connection":
        return "无法连接 Soniox。请检查网络后重试。";
      case "invalid-audio":
        return "无法读取录音。";
      case "no-audio":
        return "没有收到 G2 麦克风的声音，因此未进行转写。请再次长按说话。";
      case "protocol":
        return "无法读取 Soniox 的回复。请重试。";
      case "aborted":
        return "转写已取消。";
      case "overflow":
        return "发送到 Soniox 的速度跟不上录音，已停止。请检查网络后重试。";
    }
  },
  thrown: {
    relayOrigin: "请只输入服务器的 HTTPS 地址，后面不要加任何内容。",
    pairCode: "请粘贴服务器控制台中显示的完整 64 位连接密钥（0-9、a-f）。",
    emptyRecording: "录音为空或无法读取。",
    invalidRecording: "无法读取录音。",
    noSpeech: "未识别到语音。请再说一遍。",
    sonioxKey: "这看起来不是 Soniox 密钥。请粘贴从 Soniox Console 复制的完整密钥。",
  },

  page: {
    lede: "用语音向 Dot 提问，并在眼镜上阅读回复。",
    "language-label": "语言 · Language",
    "pair-legend": "连接到您的服务器",
    "origin-label": "服务器地址（HTTPS）",
    "origin-hint": "末尾不要加 /mcp。/mcp 仅用于连接 ChatGPT。",
    "dashboard-link-text": "在控制台获取连接密钥",
    "dashboard-link-note": "（在浏览器中打开）",
    "copy-dashboard": "复制控制台地址",
    "dashboard-steps": "在控制台中登录，创建连接密钥（或查看您的密钥）并复制。然后回到这里，粘贴后点按“连接”。",
    "dashboard-fallback": "如果链接打不开，请复制下方地址并在手机浏览器中打开。返回时，请从 Even 应用重新打开此页面。",
    "dashboard-address-label": "控制台地址（长按可复制）",
    "code-label": "连接密钥",
    "code-hint": "粘贴您在服务器控制台中创建的 64 位连接密钥。",
    "pair-submit": "连接",
    disconnect: "断开并忘记此连接",
    "soniox-legend": "语音转写（您的 Soniox 密钥）",
    "soniox-get-intro":
      "如需语音提问，您需要自己的 Soniox API 密钥。请在 Soniox Console 注册或登录，创建 API 密钥，然后粘贴到下方。",
    "soniox-console-text": "获取 Soniox API 密钥",
    "soniox-console-note": "（在浏览器中打开 Soniox Console）",
    "soniox-privacy":
      "您的语音从这部手机直接发送到 Soniox 转为文字，只有这些文字会发送到您的服务器。您的密钥和音频绝不会到达服务器。为安全起见，请在 Soniox Console 中为此应用单独创建一个密钥。",
    "soniox-key-label": "Soniox API 密钥",
    "soniox-remember-text": "在这部手机上记住密钥",
    "soniox-remember-hint":
      "关闭时，密钥只保留到您关闭应用为止。已设置密钥时更改此项会立即保存或删除密钥。密钥保存在 Even 应用存储中，该存储可能未加密。",
    "soniox-apply": "使用此密钥",
    "soniox-clear": "删除密钥",
    voice: "向 Dot 提问",
    "voice-note": "在 G2 上长按、说话，然后松开。您说的话会转为文字并自动发送给 Dot。最长 30 秒；需要 Soniox 密钥。",
    "auto-send-text": "转写后自动发送（关闭后可在发送前检查）",
    "wake-text": "Hey dots 免提语音（默认开启；应用在 G2 上打开期间使用 G2 麦克风）",
    "wake-hint":
      "只有在 G2 就绪、已连接且已设置 Soniox 密钥时，G2 麦克风才会打开。应用在 G2 上打开期间，这部手机会自行检测唤醒词，即使手机屏幕关闭或锁定，也会继续收听并检查回复；Even 应用和手机的后台限制可能会影响这一点。不会使用手机自身的麦克风。先说 Hey dots（英语发音），再说出问题：只有其后的问题会由 Soniox 转写，并以文字形式发送到您的服务器。如果没有反应，请改为长按说话。关闭此项会立即停止收听。",
    record: "开始录音",
    stop: "停止并转写",
    "text-label": "消息（也可以输入文字代替说话）",
    send: "发送给 Dot",
    "reply-title": "Dot 的回复",
    "prev-message": "上一条消息",
    "next-message": "下一条消息",
    prev: "G2 上一部分",
    next: "G2 下一部分",
    "help-title": "帮助与反馈",
    "help-note": "项目的 GitHub 页面提供使用指南和源代码。如有问题或功能建议，请在 GitHub Issues 中提出。",
    "guide-link-text": "使用指南和源代码",
    "guide-link-note": "（在浏览器中打开 GitHub）",
    "help-link-text": "问题与功能建议",
    "help-link-note": "（在浏览器中打开 GitHub）",
  },
  placeholders: {
    status: "正在检查与 Even 应用的连接",
    reply: "正在等待回复。",
    display: "尚未在 G2 上显示",
  },

  afterConnecting: "连接后，长按并说话。",
  micStopUnconfirmed: "麦克风可能仍处于开启状态。请长按重试，或在 Even 应用中关闭本应用。",
  settingsUnread: "无法加载已保存的语音设置，因此已关闭 Hey dots 和自动发送。如有需要，请重新开启。",
  micOff: "麦克风关闭",
  draftPausesRecording: "您有一条未发送的消息，因此录音已暂停。请先发送或清除。",
  noSonioxKey: "请在设置中添加您的 Soniox 密钥以使用语音提问。也可以输入消息后发送。",
  keyRemovalUnconfirmed: "密钥已在此处清除，但未能确认已从 Even 应用存储中删除。请再次点按“删除密钥”。",
  keySessionOnlyOldMayRemain:
    "密钥仅在本次使用期间有效。由于未能确认 Even 应用存储的更改，之前记住的密钥可能仍被保存。",
  keyRemembered: "已设置 Soniox 密钥 · 已记在这部手机的 Even 应用存储中，直到您删除。",
  keySessionOnly: "已设置 Soniox 密钥 · 仅保留到您关闭应用为止。",
  recordingNoSound: "正在录音 · 尚未收到 G2 的声音 · 请继续说话，声音会被接收。",
  wakeListeningNoSound: "Hey dots 正在收听 · 尚未收到 G2 的声音 · 环境安静时属正常现象。",
  micTurningOff: "正在关闭麦克风",
  wakeOffMicOff: "Hey dots 已关闭 · 麦克风关闭",
  wakeNoKeyMicOff: "Hey dots 不可用 · 没有 Soniox 密钥 · 麦克风关闭",
  wakePausedMicOff: "Hey dots 已暂停 · 麦克风关闭",
  wakePreparing: "正在这部手机上准备 Hey dots",
  wakeHeardNow: "已听到 Hey dots · 请现在提问。",
  wakeHeard: "已听到 Hey dots · 请提问。",
  readyForQuestion: "请提问。说 Hey dots 或长按说话。",
  wakeStopped: "Hey dots 已停止收听。请长按说话，或输入消息。",
  micStartFailed: "无法打开 G2 麦克风。",
  wakeMicStarting: "正在打开 G2 麦克风 · 等待声音",
  historyDeleted: "您的对话记录已删除，因此其回复也已从这部手机上移除。正在输入的内容会保留，您可以提出新问题。",
  historyExpired: "超过保留期限的回复也已从这部手机上移除。",
  ackPending: "最终回答即将到来",
  ackLabel: "中间回复",
  finalLabel: "最终回答",
  somethingWrong: "出了点问题。",
  waitingEvenApp: "正在等待 Even 应用。",
  preparingG2: "正在准备 G2 屏幕。",
  loadingSettings: "正在加载已保存的语音设置。",
  connectToRecord: "请先连接服务器再录音。",
  sonioxToRecord: "录音需要 Soniox 密钥。您仍可在下方输入消息并发送。",
  finishingPrevious: "正在完成上一个请求。",
  messagePosition: (index, count, stage) => `第 ${index} 条，共 ${count} 条消息${stage ? ` · ${stage}` : ""}`,
  noMessages: "暂无消息。",
  connectFirst: "请先连接服务器。",
  connectionExpired: "此连接已过期。请断开连接，然后使用新的连接密钥重新连接。",
  questionRejected:
    "由于对话已删除或已超过保留期限，服务器未接收此问题。它不会自动重新发送；再次发送将作为新问题发送。",
  serverFailed: (status) => `服务器请求失败（${status}）`,
  g2NotConnected: "G2 尚未连接 · 可以在手机上阅读。",
  showingOnG2: "正在 G2 上显示…",
  g2UpdateFailed: "无法更新 G2 · 请在手机上阅读回复。",
  showingLiveCaption: "正在 G2 上显示实时转写（未定稿）",
  shownOnG2: "已在 G2 上显示。",
  g2Unconfirmed: "无法确认 G2 是否已更新。",
  replyPosition: (index, count) => `${index}/${count}`,
  voiceStopped: "语音输入已停止 · 未发送任何内容。",
  replyBackToReading: "Dot 已回复 · 回到您正在阅读的消息。请转到下一条消息查看新回复。",
  replyShowingLatest: "Dot 已回复 · 正在 G2 上显示最新回复。",
  exitFailed: "无法关闭 · 请再次双击",
  exitRequestFailed: "无法请求 G2 关闭应用。请再次双击，或在 Even 应用中关闭。",
  staleResponse: "已跳过一条过时的服务器响应，它比已显示的对话更旧。",
  unversionedResponse: "已跳过一条没有对话版本的服务器响应，因为它可能包含已删除的回复。",
  erasedReplyAfterVoice: (erased) => `${erased}新回复将在您的语音输入发送后显示在 G2 上。`,
  replyAfterVoice: "Dot 已回复 · 将在您的语音输入发送后显示在 G2 上。",
  erasedShowingNew: (erased) => `${erased}正在显示新回复。`,
  ackReceived: "已收到 Dot 的中间回复 · 最终回答即将到来 · 正在 G2 上显示。",
  finalReceived: "已收到 Dot 的最终回答 · 正在 G2 上显示。中间回复保留在上一条消息中。",
  replyShowing: "Dot 已回复 · 正在 G2 上显示。",
  finishingTranscriptWaiting: "正在完成转写 · 等待最终文字",
  finishingTranscript: "正在完成转写 · 尚未发送",
  transcriptReady: "转写完成 · 请检查后发送。",
  transcriptAppended: "转写完成 · 已添加在您输入的内容之后。请检查后发送。",
  transcriptReadyPhone: "转写完成 · 请在手机上检查后发送。",
  sendUnconfirmed: "无法确认是否已发送。",
  sendFailed: "无法发送。",
  transcriptKept: (reason) => `${reason}转写内容保留在消息框中。请检查后重新发送。`,
  manualMicStarting: "正在打开 G2 麦克风 · 等待您的声音",
  recordingLive: "正在录音 · 边说边转为文字 · 停止后发送最终文字。",
  recordingHold: "正在录音 · 松开即转写并发送。",
  micOffProcessing: "麦克风关闭 · 正在处理您的语音",
  settingsSaveFailed: "无法保存设置。设置现已生效，但下次启动时可能使用之前的设置。",
  sending: "正在发送到服务器 · 尚未确认",
  delivered: "已保存并送达 Dot · 正在等待回复。",
  savedNotDelivered: "已保存在服务器上 · Dot 尚未确认或回复。",
  savedThenDeleted: "服务器已收到问题，但对话在此期间被删除，因此此问题可能也已不存在。",
  replyReady: "回复已就绪 · 正在加载。",
  messageKept: (reason) => `${reason}您的消息仍在消息框中。`,
  dashboardNeedsOrigin: "要打开控制台，请输入服务器的 HTTPS 地址，后面不要加任何内容。",
  dashboardCopied: "已复制控制台地址。请在手机浏览器中打开。",
  dashboardCopyFailed: "无法复制。请长按上方的控制台地址进行复制。",
  languageSaveFailed: "无法保存语言选择。现在已生效，但下次启动时可能显示其他语言。",
  originInvalid: "服务器地址无效。请输入以 https:// 开头的地址。",
  connecting: "正在连接服务器",
  connectTimeout: "服务器在 15 秒内没有响应。请检查地址和网络。",
  connectNetwork: "无法连接服务器。请检查地址和网络。",
  keyRejected: (status) => `连接密钥错误或已过期（${status}）。请获取新密钥后重新输入。`,
  connectFailed: (status) => `无法连接服务器（${status}）· 请稍后重试。`,
  connectIncomplete: "服务器未完成连接。",
  connectSaveFailed: "无法保存连接。请使用新的连接密钥重新连接。",
  connected: "已连接到服务器 · 请同时在 Dot 中完成连接和订阅。",
  connectFailedGeneric: "无法连接。",
  previousConnectionKept: (message) => `${message}已保留之前的连接。`,
  keyFailed: "无法使用此密钥。",
  waitForEvenApp: "请等待 Even 应用连接后再输入密钥。",
  keySaving: "正在保存密钥",
  keyUpdating: "正在更改密钥的保存方式",
  keyRemoving: "正在删除密钥",
  disconnected: "已断开连接。",
  connectionForgotten: "这部手机已忘记此连接。请同时在服务器上移除此设备，以彻底撤销。",
  forgetUnconfirmed: "无法确认已删除保存的连接。请检查 Even 应用存储的数据。",
  voiceStoppedAppSwitch: "由于您在 G2 上切换了应用，语音输入已停止。请说 Hey dots 或长按再次说话。",
  pageHidden: "页面已关闭或隐藏，因此收听、录音和回复检查已停止。页面恢复后会继续。",
  pageBack: "页面已恢复 · 收听和回复检查继续进行。",
  evenAppMissing: (app) => `找不到 Even 应用。请从 Even 应用中打开 ${app}。`,
  g2StartFailed: "无法启动 G2 屏幕。请从 Even 应用中重新打开应用。",
  micOnWake: "麦克风开启 · 这部手机正在检测 Hey dots · 说出之前不会发送任何内容。",
  micOnRecording: "麦克风开启 · 正在录音",
  badAudioFrame: "收到了无法读取的声音。",
  abnormalExit: "G2 上的应用意外关闭，因此收听、录音和回复检查已停止。请从 Even 应用中重新打开。",
  systemExit: "G2 上的应用已关闭，因此收听、录音和回复检查已停止。如需再次使用，请在 G2 上打开。",
  foregroundExit: "您在 G2 上切换了应用，因此收听、录音和回复检查已停止。在 G2 上重新打开后会继续。",
  foregroundBack: "已回到 G2 · 收听和回复检查重新开始。",
  keyLoadFailed: "无法加载已保存的 Soniox 密钥。请重新输入，或点按“删除密钥”。",
  savedConnectionUnreadable: "无法读取已保存的连接。请使用新的连接密钥连接。",
  usingSavedConnection: "正在使用已保存的服务器连接。",
  g2ReadyEnterConnection: "G2 已就绪 · 请输入服务器地址和连接密钥。",
};
