import type { Messages } from "./en.ts";

/** Japanese. */
export const ja: Messages = {
  languageShown: "アプリを日本語で表示しています。",

  idle(state, app) {
    if (!state.restored) return `${app} · 保存された接続を確認しています。`;
    if (!state.connected)
      return `${app} · スマートフォンのアプリでサーバーアドレスと接続キーを入力して接続してください。`;
    if (!state.transcriber)
      return `${app} · 音声で質問するには、スマートフォンのアプリでご自身の Soniox キーを追加してください。入力して送信することもできます。`;
    return `${app} · 長押ししたまま質問を話し、指を離してください。`;
  },
  edge(count, delta) {
    if (!count) return "まだ返答はありません";
    return delta < 0 ? "最初の返答です" : "最後の返答です";
  },
  splitMarkers: { continues: "\n（続く）", continued: "（続き）\n" },
  captionLive: "リアルタイム文字起こし（未確定）",
  captionFinishing: "文字起こしを仕上げ中 · 未確定 · まだ送信していません",
  wakeBlocked: {
    settings: "Hey dots · 設定を読み込み中",
    enabled: "Hey dots オフ · マイクオフ",
    active: "Hey dots 一時停止 · G2 でアプリを開いてください",
    ready: "Hey dots · G2 を待っています",
    connected: "Hey dots · スマートフォンのアプリで接続してください",
    transcriber: "Hey dots · スマートフォンで Soniox キーを追加",
    manual: "Hey dots 一時停止 · 手動録音中",
    busy: "Hey dots 一時停止 · リクエストを処理中",
    draft: "Hey dots 一時停止 · 下書きを送信または消去",
  },
  g2Mic: {
    micOff: "マイクオフ",
    micTurningOff: "マイクをオフにしています",
    micStopUnconfirmed: "マイクがまだオンの可能性",
    wakeOffMicOff: "Hey dots オフ · マイクオフ",
    wakeNoKeyMicOff: "Soniox キーなし · マイクオフ",
    wakePausedMicOff: "Hey dots 一時停止 · マイクオフ",
    wakePreparing: "Hey dots を準備中",
    wakeHeardNow: "マイクオン · Hey dots を検出",
    wakeStopped: "Hey dots 停止",
    wakeMicStarting: "マイク起動中",
    manualMicStarting: "マイク起動中",
    micOffProcessing: "マイクオフ · 処理中",
    micOnWake: "マイクオン · Hey dots 待機中",
    micOnRecording: "マイクオン · 録音中",
    recordingNoSound: "マイクオン · 録音中 · 音がまだありません",
    wakeListeningNoSound: "マイクオン · Hey dots · 音がまだありません",
  },
  g2MicCore: { on: "マイクオン", off: "マイクオフ", unsure: "マイクがオンの可能性" },

  requestFailure(kind, submission) {
    const cause = {
      timeout: "サーバーが 45 秒以内に応答しなかったため、リクエストを取り消しました。ネットワークを確認してください。",
      cancelled: "メガネでアプリが閉じられたか切り替えられたため、サーバーへのリクエストを取り消しました。",
      network: "サーバーに接続できませんでした。ネットワーク接続を確認してください。",
    }[kind];
    return submission
      ? `${cause}サーバーに保存されたかどうかはわかりません。保存されていれば返答は取り消されず、届いたときにここに表示されます。`
      : cause;
  },
  stt(error) {
    switch (error.kind) {
      case "credential":
        return "この Soniox キーは使用できません。設定でキーを入力し直してください。";
      case "provider":
        return error.status === 401 || error.status === 403
          ? "Soniox がキーを受け付けませんでした。Soniox Console でキーを確認するか、新しいキーに置き換えてください。"
          : `Soniox で文字起こしできませんでした${error.status === undefined ? "" : `（コード ${error.status}）`}。もう一度お試しください。`;
      case "timeout":
        return "Soniox の応答に時間がかかりすぎました。もう一度お試しください。";
      case "connection":
        return "Soniox に接続できませんでした。ネットワークを確認して、もう一度お試しください。";
      case "invalid-audio":
        return "録音を読み取れませんでした。";
      case "no-audio":
        return "G2 のマイクから音が届かなかったため、文字起こししませんでした。もう一度長押しして話してください。";
      case "protocol":
        return "Soniox から読み取れない応答が届きました。もう一度お試しください。";
      case "aborted":
        return "文字起こしを取り消しました。";
      case "overflow":
        return "Soniox への送信が録音に追いつかなかったため、停止しました。ネットワークを確認して、もう一度お試しください。";
    }
  },
  thrown: {
    relayOrigin: "サーバーの HTTPS アドレスだけを、後ろに何も付けずに入力してください。",
    pairCode: "サーバーのダッシュボードに表示された 64 文字の接続キー（0-9、a-f）をすべて貼り付けてください。",
    emptyRecording: "録音が空か、読み取れませんでした。",
    invalidRecording: "録音を読み取れませんでした。",
    noSpeech: "音声を認識できませんでした。もう一度話してください。",
    sonioxKey: "Soniox キーではないようです。Soniox Console からコピーしたキー全体を貼り付けてください。",
  },

  page: {
    lede: "音声で Dot に質問し、返答をメガネで読めます。",
    "language-label": "言語 · Language",
    "pair-legend": "サーバーに接続",
    "origin-label": "サーバーアドレス（HTTPS）",
    "origin-hint": "末尾に /mcp を付けないでください。/mcp は ChatGPT の接続専用です。",
    "dashboard-link-text": "ダッシュボードで接続キーを取得",
    "dashboard-link-note": "（ブラウザで開きます）",
    "copy-dashboard": "ダッシュボードのアドレスをコピー",
    "dashboard-steps":
      "ダッシュボードでサインインし、接続キーを作成して（またはキーを表示して）コピーします。その後ここに戻り、貼り付けて「接続」をタップしてください。",
    "dashboard-fallback":
      "リンクが開かない場合は、下のアドレスをコピーしてスマートフォンのブラウザで開いてください。戻るときは、Even アプリからこの画面を開き直してください。",
    "dashboard-address-label": "ダッシュボードのアドレス（長押しでコピー）",
    "code-label": "接続キー",
    "code-hint": "サーバーのダッシュボードで作成した 64 文字の接続キーを貼り付けてください。",
    "pair-submit": "接続",
    disconnect: "接続を解除して保存した接続情報を削除",
    "soniox-legend": "音声の文字起こし（ご自身の Soniox キー）",
    "soniox-get-intro":
      "音声で質問するには、ご自身の Soniox API キーが必要です。Soniox Console に登録またはサインインして API キーを作成し、下に貼り付けてください。",
    "soniox-console-text": "Soniox API キーを取得",
    "soniox-console-note": "（ブラウザで Soniox Console を開きます）",
    "soniox-privacy":
      "音声はこのスマートフォンから Soniox に直接送られて文字になり、その文字だけがサーバーに送信されます。キーと音声がサーバーに届くことはありません。安全のため、Soniox Console でこのアプリ専用のキーを別に作成してください。",
    "soniox-key-label": "Soniox API キー",
    "soniox-remember-text": "このスマートフォンにキーを記憶する",
    "soniox-remember-hint":
      "オフの場合、キーはアプリを閉じるまでしか保持されません。キーが設定されているときに変更すると、すぐに保存または削除されます。キーは Even アプリのストレージに保存され、暗号化されていない可能性があります。",
    "soniox-apply": "このキーを使う",
    "soniox-clear": "キーを削除",
    voice: "Dot に質問",
    "voice-note":
      "G2 で長押ししたまま話し、指を離します。話した内容は文字に変換され、自動的に Dot に送信されます。最長 30 秒。Soniox キーが必要です。",
    "auto-send-text": "文字起こし後に自動送信（オフにすると送信前に確認できます）",
    "wake-text": "Hey dots ハンズフリー音声（初期設定はオン。G2 でアプリを開いている間、G2 のマイクを使います）",
    "wake-hint":
      "G2 のマイクが開くのは、G2 の準備ができ、接続済みで、Soniox キーが設定されているときだけです。G2 でアプリを開いている間、このスマートフォンが自分でウェイクワードを検出し、画面が消えたりロックされたりしても聞き取りと返答の確認を続けます。Even アプリやスマートフォンのバックグラウンド制限の影響を受けることがあります。スマートフォン本体のマイクは使いません。Hey dots（英語の発音）と言ってから質問してください。その後の質問だけが Soniox で文字起こしされ、文字としてサーバーに送信されます。反応しない場合は、長押しして話してください。オフにするとすぐに聞き取りを止めます。",
    record: "録音を開始",
    stop: "停止して文字起こし",
    "text-label": "メッセージ（話す代わりに入力することもできます）",
    send: "Dot に送信",
    "reply-title": "Dot からの返答",
    "prev-message": "前のメッセージ",
    "next-message": "次のメッセージ",
    prev: "G2 の前の部分",
    next: "G2 の次の部分",
    "help-title": "ヘルプとフィードバック",
    "help-note":
      "プロジェクトの GitHub ページに使い方ガイドとソースコードがあります。質問や機能のリクエストは GitHub Issues で受け付けています。",
    "guide-link-text": "使い方ガイドとソースコード",
    "guide-link-note": "（ブラウザで GitHub を開きます）",
    "help-link-text": "質問と機能のリクエスト",
    "help-link-note": "（ブラウザで GitHub を開きます）",
  },
  placeholders: {
    status: "Even アプリとの接続を確認しています",
    reply: "返答を待っています。",
    display: "まだ G2 に表示されていません",
  },

  afterConnecting: "接続したら、長押しして話してください。",
  micStopUnconfirmed:
    "マイクがまだオンになっている可能性があります。長押ししてやり直すか、Even アプリからアプリを閉じてください。",
  settingsUnread:
    "保存された音声設定を読み込めなかったため、Hey dots と自動送信をオフにしました。必要に応じてオンに戻してください。",
  micOff: "マイクオフ",
  draftPausesRecording: "未送信のメッセージがあるため、録音を一時停止しています。先に送信するか消去してください。",
  noSonioxKey:
    "音声で質問するには、設定でご自身の Soniox キーを追加してください。メッセージを入力して送信することもできます。",
  keyRemovalUnconfirmed:
    "ここではキーを消去しましたが、Even アプリのストレージからの削除を確認できませんでした。もう一度「キーを削除」をタップしてください。",
  keySessionOnlyOldMayRemain:
    "キーは今回のセッションだけで使います。Even アプリのストレージの変更を確認できなかったため、以前記憶したキーが残っている可能性があります。",
  keyRemembered: "Soniox キーを設定しました · 削除するまで、このスマートフォンの Even アプリのストレージに記憶します。",
  keySessionOnly: "Soniox キーを設定しました · アプリを閉じるまでだけ保持します。",
  recordingNoSound: "録音中 · G2 からの音はまだありません · 話し続ければ受け取ります。",
  wakeListeningNoSound: "Hey dots 聞き取り中 · G2 からの音はまだありません · 静かなときは正常な場合があります。",
  micTurningOff: "マイクをオフにしています",
  wakeOffMicOff: "Hey dots オフ · マイクオフ",
  wakeNoKeyMicOff: "Hey dots 使用不可 · Soniox キーなし · マイクオフ",
  wakePausedMicOff: "Hey dots 一時停止 · マイクオフ",
  wakePreparing: "このスマートフォンで Hey dots を準備しています",
  wakeHeardNow: "Hey dots を検出 · 今すぐ質問してください。",
  wakeHeard: "Hey dots を検出 · 質問してください。",
  readyForQuestion: "質問をどうぞ。Hey dots と言うか、長押しして話してください。",
  wakeStopped: "Hey dots の聞き取りが止まりました。長押しして話すか、メッセージを入力してください。",
  micStartFailed: "G2 のマイクをオンにできませんでした。",
  wakeMicStarting: "G2 のマイクをオンにしています · 音を待っています",
  historyDeleted:
    "会話履歴が削除されたため、その返答もこのスマートフォンから消えました。入力中の内容はそのまま残っており、新しい質問ができます。",
  historyExpired: "保存期間を過ぎた返答は、このスマートフォンからも削除しました。",
  ackPending: "最終回答待ち",
  ackLabel: "途中の返答",
  finalLabel: "最終回答",
  somethingWrong: "問題が発生しました。",
  waitingEvenApp: "Even アプリを待っています。",
  preparingG2: "G2 の画面を準備しています。",
  loadingSettings: "保存された音声設定を読み込んでいます。",
  connectToRecord: "録音するには、まずサーバーに接続してください。",
  sonioxToRecord: "録音するには Soniox キーが必要です。下にメッセージを入力して送信することはできます。",
  finishingPrevious: "前のリクエストを処理しています。",
  messagePosition: (index, count, stage) => `メッセージ ${index} / ${count}${stage ? ` · ${stage}` : ""}`,
  noMessages: "まだメッセージはありません。",
  connectFirst: "まずサーバーに接続してください。",
  connectionExpired: "この接続は期限切れです。接続を解除してから、新しい接続キーで接続し直してください。",
  questionRejected:
    "会話が削除されたか保存期間を過ぎたため、サーバーはこの質問を受け付けませんでした。自動では再送しません。もう一度送信すると、新しい質問として送られます。",
  serverFailed: (status) => `サーバーへのリクエストに失敗しました（${status}）`,
  g2NotConnected: "G2 はまだ接続されていません · スマートフォンで読めます。",
  showingOnG2: "G2 に表示しています…",
  g2UpdateFailed: "G2 を更新できませんでした · 返答はスマートフォンで読んでください。",
  showingLiveCaption: "G2 にリアルタイム文字起こし（未確定）を表示中",
  shownOnG2: "G2 に表示しました。",
  g2Unconfirmed: "G2 が更新されたか確認できませんでした。",
  replyPosition: (index, count) => `${index}/${count}`,
  voiceStopped: "音声入力を停止しました · 何も送信していません。",
  replyBackToReading:
    "Dot から返答 · 読んでいたメッセージに戻ります。新しい返答は次のメッセージに移動して確認してください。",
  replyShowingLatest: "Dot から返答 · G2 に最新の返答を表示しています。",
  exitFailed: "終了失敗 · 2回タップ",
  exitRequestFailed:
    "G2 にアプリを閉じるよう依頼できませんでした。もう一度ダブルタップするか、Even アプリから閉じてください。",
  staleResponse: "表示済みの会話より古いサーバー応答だったため、表示しませんでした。",
  unversionedResponse: "会話のバージョンがないサーバー応答は削除済みの返答を含む可能性があるため、表示しませんでした。",
  erasedReplyAfterVoice: (erased) => `${erased}新しい返答は、音声入力を送信した後で G2 に表示します。`,
  replyAfterVoice: "Dot から返答 · 音声入力を送信した後で G2 に表示します。",
  erasedShowingNew: (erased) => `${erased}新しい返答を表示します。`,
  ackReceived: "Dot から途中の返答を受信 · 最終回答待ち · G2 に表示しています。",
  finalReceived: "Dot から最終回答を受信 · G2 に表示しています。途中の返答は前のメッセージに残っています。",
  replyShowing: "Dot から返答 · G2 に表示しています。",
  finishingTranscriptWaiting: "文字起こしを仕上げ中 · 最終テキストを待っています",
  finishingTranscript: "文字起こしを仕上げ中 · まだ送信していません",
  transcriptReady: "文字起こし完了 · 確認してから送信してください。",
  transcriptAppended: "文字起こし完了 · 入力中の内容の後ろに追加しました。確認してから送信してください。",
  transcriptReadyPhone: "文字起こし完了 · スマートフォンで確認してから送信してください。",
  sendUnconfirmed: "送信されたかどうか確認できませんでした。",
  sendFailed: "送信できませんでした。",
  transcriptKept: (reason) => `${reason}文字起こしはメッセージ欄に残してあります。確認して、もう一度送信してください。`,
  manualMicStarting: "G2 のマイクをオンにしています · 声を待っています",
  recordingLive: "録音中 · 話しながら文字に変換しています · 停止すると最終テキストを送信します。",
  recordingHold: "録音中 · 指を離すと文字起こしして送信します。",
  micOffProcessing: "マイクオフ · 音声を処理しています",
  settingsSaveFailed:
    "設定を保存できませんでした。今は適用されていますが、次回の起動時には以前の設定が使われる場合があります。",
  sending: "サーバーに送信中 · まだ確認されていません",
  delivered: "保存して Dot に届けました · 返答を待っています。",
  savedNotDelivered: "サーバーに保存しました · Dot の確認と返答はまだです。",
  savedThenDeleted:
    "サーバーは質問を受け取りましたが、その間に会話が削除されたため、この質問も消えている可能性があります。",
  replyReady: "返答の準備ができました · 読み込んでいます。",
  messageKept: (reason) => `${reason}入力した内容はメッセージ欄に残っています。`,
  dashboardNeedsOrigin: "ダッシュボードを開くには、サーバーの HTTPS アドレスを後ろに何も付けずに入力してください。",
  dashboardCopied: "ダッシュボードのアドレスをコピーしました。スマートフォンのブラウザで開いてください。",
  dashboardCopyFailed: "コピーできませんでした。上のダッシュボードのアドレスを長押ししてコピーしてください。",
  languageSaveFailed:
    "言語の選択を保存できませんでした。今は適用されていますが、次回の起動時には別の言語で表示される場合があります。",
  originInvalid: "サーバーアドレスが正しくありません。https:// で始まるアドレスを入力してください。",
  connecting: "サーバーに接続しています",
  connectTimeout: "サーバーが 15 秒以内に応答しませんでした。アドレスとネットワークを確認してください。",
  connectNetwork: "サーバーに接続できませんでした。アドレスとネットワークを確認してください。",
  keyRejected: (status) =>
    `接続キーが正しくないか、期限切れです（${status}）。新しいキーを取得して、もう一度入力してください。`,
  connectFailed: (status) => `サーバーに接続できませんでした（${status}）· しばらくしてからもう一度お試しください。`,
  connectIncomplete: "サーバーが接続を完了しませんでした。",
  connectSaveFailed: "接続を保存できませんでした。新しい接続キーで接続し直してください。",
  connected: "サーバーに接続しました · Dot でも接続と購読を完了してください。",
  connectFailedGeneric: "接続できませんでした。",
  previousConnectionKept: (message) => `${message}以前の接続はそのまま残します。`,
  keyFailed: "このキーを使用できませんでした。",
  waitForEvenApp: "Even アプリが接続されるまで待ってから、キーを入力してください。",
  keySaving: "キーを保存しています",
  keyUpdating: "キーの保存方法を変更しています",
  keyRemoving: "キーを削除しています",
  disconnected: "接続を解除しました。",
  connectionForgotten:
    "このスマートフォンから接続を削除しました。完全に無効にするには、サーバーでもこのデバイスを削除してください。",
  forgetUnconfirmed: "保存された接続を削除できたか確認できませんでした。Even アプリの保存データを確認してください。",
  voiceStoppedAppSwitch:
    "G2 でアプリが切り替えられたため、音声入力を停止しました。Hey dots と言うか、長押ししてもう一度話してください。",
  pageHidden:
    "ページが閉じられたか非表示になったため、聞き取り、録音、返答の確認を停止しました。ページが戻ると再開します。",
  pageBack: "ページが戻りました · 聞き取りと返答の確認を続けます。",
  evenAppMissing: (app) => `Even アプリが見つかりません。Even アプリから ${app} を開いてください。`,
  g2StartFailed: "G2 の画面を開始できませんでした。Even アプリからアプリを開き直してください。",
  micOnWake: "マイクオン · このスマートフォンで Hey dots を待っています · 言うまでは何も送信しません。",
  micOnRecording: "マイクオン · 録音中",
  badAudioFrame: "読み取れない音を受信しました。",
  abnormalExit:
    "G2 でアプリが予期せず終了したため、聞き取り、録音、返答の確認を停止しました。Even アプリから開き直してください。",
  systemExit:
    "G2 でアプリが閉じられたため、聞き取り、録音、返答の確認を停止しました。再び使うには G2 でアプリを開いてください。",
  foregroundExit:
    "G2 でアプリを切り替えたため、聞き取り、録音、返答の確認を停止しました。G2 でもう一度開くと再開します。",
  foregroundBack: "G2 に戻りました · 聞き取りと返答の確認を再開します。",
  keyLoadFailed:
    "保存された Soniox キーを読み込めませんでした。もう一度入力するか、「キーを削除」をタップしてください。",
  savedConnectionUnreadable: "保存された接続を読み取れませんでした。新しい接続キーで接続してください。",
  usingSavedConnection: "保存されたサーバー接続を使っています。",
  g2ReadyEnterConnection: "G2 準備完了 · サーバーアドレスと接続キーを入力してください。",
};
