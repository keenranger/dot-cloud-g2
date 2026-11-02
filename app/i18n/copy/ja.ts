import type { Copy } from "../dashboard";
import { PRODUCT_NAME } from "../product";

export const ja: Copy = {
  dateLocale: "ja-JP",
  languageName: "日本語",
  page: {
    home: `${PRODUCT_NAME} ホーム`,
    headerNote: "EVEN G2 × CHATGPT DOT 向け",
    language: "言語",
    signOut: "サインアウト",
    eyebrow: "スマートフォンを取り出さずに質問",
    titleLines: ["メガネで質問して、", "Dot の返事をその場で読む。"],
    intro: "Even G2 から ChatGPT Dot に話しかけ、答えをレンズ上で読めます。",
    needs:
      "スマートフォンの Even Hub アプリに接続した G2、一度だけの設定に使うパソコンのブラウザーの ChatGPT、音声で質問する場合は Soniox アカウントが必要です。",
    flowLabel: "使い方",
    flow: ["G2 で話す", "Dot が答える", "G2 で読む"],
    signInEyebrow: "はじめに",
    signInTitle: "サインインしてメガネを設定",
    signInBody:
      "ChatGPT アカウントでサインインすると、G2 をペアリングして Dot を接続できます。パソコンにインストールするものはありません。",
    signIn: "ChatGPT でサインイン",
    previewTitle: "早期プレビュー",
    previewBody: "メガネに届く Dot の返事はまだ実機でテスト中のため、一部の返事が届かない場合があります。",
    footer: "メガネと Dot をつなぎます。",
    policies: "ポリシー",
    privacy: "プライバシー通知",
    terms: "利用規約",
    apply: "適用",
    support: "ヘルプとフィードバック",
    supportGuide: "GitHub で使い方ガイドとソースコードを見る",
    supportIssues: "GitHub Issues で質問や機能リクエストを送る",
    newTab: "（新しいタブで開きます）",
    metaTitle: "G2 メガネで使う ChatGPT Dot",
    metaDescription: "Even G2 から ChatGPT Dot に話しかけ、返事をメガネで読めます。",
  },
  policy: {
    formerly: "旧名称 Lens MCP for G2",
    effective: "発効日",
    englishVersion: "英語版",
  },
  notFound: {
    title: "ページが見つかりません",
    body: "このページは存在しないか、移動しました。",
    home: "ホームへ移動",
  },
  error: {
    title: "問題が発生しました",
    body: "このページを表示できませんでした。もう一度試すか、ホームへ移動してください。問題が続く場合は GitHub Issues でお知らせください。",
    retry: "もう一度試す",
    home: "ホームへ移動",
  },
  dashboard: {
    eyebrow: "あなたの接続",
    title: "あなたの設定",
    refresh: "状態を更新",
    checking: "確認中…",
    statusLabel: "接続状態",
    statusChecking: "確認中",
    statusUnavailable: "確認できません",
    devices: "ペアリング済みのメガネ",
    deviceCount: (n) => `${n} 台`,
    dot: "Dot",
    dotSubscribed: "聞き取り中",
    dotWaiting: "まだ接続されていません",
    pending: "Dot の返事を待っている質問",
    pendingCount: (n) => `${n} 件`,
    speech: "音声入力",
    speechValue: "スマートフォンのアプリで確認",
    delivery: {
      accepted: "Dot が受け取りました",
      http_4xx: "Dot が拒否しました",
      http_5xx: "Dot 側で問題が発生",
      http_other: "予期しない応答",
      timeout: "Dot の応答に時間がかかりすぎました",
      network: "ネットワークの問題",
      invalid_response: "読み取れない応答",
    },
    lastDelivery: (label, at, awaiting, retrying, stopped) =>
      `最後に Dot に送った質問: ${label}、${at}。返事待ち: ${awaiting} 件。再試行待ち: ${retrying} 件。再試行を停止: ${stopped} 件。「受け取りました」は Dot が質問を受け取ったという意味で、答えたことや、答えがメガネに表示されたことを意味しません。`,

    pairTitle: "ステップ 1: メガネをペアリング",
    pairBody: `スマートフォンの Even Hub アプリで ${PRODUCT_NAME} を開き、下のサーバーアドレスと接続キーを入力してください。G2 はスマートフォンに接続したままにしてください。これは ChatGPT のサインインとは別のものです。`,
    serverAddress: "サーバーアドレス",
    addressPending: "アドレスを取得中…",
    keyHelp:
      "接続キーに有効期限はなく、すべてのメガネで使えます。「キーを表示」を選ぶまで隠れたままです。新しいキーを作成するか、このキーを無効にすると、古いキーでは新しいメガネをペアリングできなくなります。ペアリング済みのメガネはそのまま使えます。",
    keyLabel: "接続キー",
    keyHidden: "非表示。「キーを表示」を選んでください。",
    showKey: "キーを表示",
    hideKey: "キーを隠す",
    copy: "コピー",
    copyLabel: (label) => `${label}をコピー`,
    keyCreated: (at) => `作成日時 ${at} · 有効期限なし`,
    legacyCode: (expires) =>
      `以前の 10 分間有効なペアリングコードがまだ有効です${expires ? `（有効期限 ${expires}）` : ""}。このコードは再表示できないため、接続キーを一度作成してください。新しいキーに有効期限はありません。`,
    keyUnavailable:
      "接続キーを確認できませんでした。「状態を更新」を選んでもう一度お試しください。確認できればキーを作成できます。",
    createKey: "接続キーを作成",
    createNewKey: "新しいキーを作成",
    creatingKey: "キーを作成中…",
    revokeKey: "キーを無効にする",
    revokingKey: "無効にしています…",
    confirmRotate:
      "新しいキーを作成すると、現在のキーでは新しいメガネをペアリングできなくなります。ペアリング済みのメガネはそのまま使えます。新しいキーを作成しますか？",
    confirmRevoke:
      "キーを無効にすると、新しいキーを作成するまでメガネを新たにペアリングできません。ペアリング済みのメガネはそのまま使えます。キーを無効にしますか？",
    cancel: "キャンセル",

    dotTitle: "ステップ 2: ChatGPT Dot を接続",
    dotBody: "Dot があなたの質問を聞き、メガネに返事できるようにします。このステップに接続キーは必要ありません。",
    dotSteps: [
      "パソコンのウェブブラウザーで ChatGPT を開き、下のアドレスをカスタムコネクタとして追加してインストールします。追加済みの場合はスキップしてください。",
      "下の設定メッセージを Dot に送ります。その後は ChatGPT モバイルアプリで同じ Dot と話し続けられます。",
    ],
    mcpAddress: "コネクタ（MCP）アドレス",
    promptLabel: "Dot に送る設定メッセージ",
    copyPrompt: "設定メッセージをコピー",
    dotPrompt: (connector) =>
      `${connector || "このサイトの /mcp アドレス"} のコネクタの "utterance.created" イベントを session "g2" で購読してください。新しい音声の質問が届いたら、質問された言語で答え、受け取ったものと同じ utterance_id と答えを text として reply_to_g2 を呼び出してください。検索やツールの使用など時間のかかる作業の前には、まず同じ utterance_id と、これから何をするかを自分の言葉で書いた短いメモを付けて acknowledge_g2_utterance を呼び出してください。「受け付けました」のような定型文は送らないでください。イベントが実際に届くまでは、接続したと言わないでください。`,

    speechTitle: "ステップ 3: 音声での質問をオンにする",
    speechBody:
      "音声で質問するには、スマートフォンのアプリにご自身の Soniox API キーを追加してください。質問を入力するだけなら、このステップは省略できます。このウェブサイトには決してキーを入力しないでください。",
    speechSteps: [
      "Soniox アカウントで、リアルタイム文字起こし（real-time transcription）を許可した API キーを作成します。",
      `スマートフォンの Even Hub アプリで ${PRODUCT_NAME} の設定を開き、キーを貼り付けます。`,
      "キーはアプリを開いている間だけ保持されます。「記憶する」を選ぶとスマートフォンに保存され、同じ設定画面からいつでも消去や置き換えができます。",
    ],
    sonioxGuide: "Soniox キーの権限の設定方法（新しいタブで開きます）",
    speechPrivacy:
      "音声はスマートフォンから Soniox に直接送られて文字に変換され、その文字だけがこのサービスと Dot に届きます。料金はご自身の Soniox アカウントに請求されます。記憶したキーの安全性はスマートフォンと Even Hub アプリ次第で、個別には暗号化されません。",

    revokeAllBody:
      "アカウントのすべてのメガネの接続を解除し、接続キーを無効にします。再び使うには、新しいキーでペアリングしてください。",
    revokeAll: "すべてのメガネの接続を解除",
    revokingAll: "接続を解除しています…",
    deleteBody:
      "このサービスから会話履歴（あなたの質問、Dot の返事、通知）を今すぐ削除します。ペアリング済みのメガネと Dot の接続はそのままです。",
    deleteConfirm:
      "この操作は元に戻せません。すでに ChatGPT（Dot）や Soniox に送られた内容、すでにスマートフォンに表示された内容は、ここからは消去できません。履歴を削除しますか？",
    deleteForever: "履歴を完全に削除",
    deleting: "削除しています…",
    deleteStart: "会話履歴を削除",

    askTitle: "ステップ 4: G2 から質問する",
    askBody:
      "ステップ 1 と 2 が終わったら、スマートフォンのアプリで質問を入力できます。ステップ 3 が終われば話して質問することもできます。Dot の答えはメガネに表示されます。",

    copied: "コピーしました。",
    copyUnavailable: "自動でコピーできませんでした。テキストを選択してご自身でコピーしてください。",
    keyShown: "接続キーを表示しました。",
    keyCreatedNotice:
      "新しい接続キーを作成しました。「キーを表示」を選び、Even Hub アプリに入力してください。古いキーでは新しいメガネをペアリングできません。ペアリング済みのメガネはそのまま使えます。",
    keyRevokedNotice:
      "接続キーを無効にしました。キーを作成するまで新しいメガネはペアリングできません。ペアリング済みのメガネはそのまま使えます。",
    sessionExpired: "サインインの有効期限が切れました。もう一度サインインしてください。",
    rateLimited: "試行回数が多すぎます。1 分待ってからもう一度お試しください。",
    keyServiceUnavailable:
      "現在、接続キーを作成または表示できません。現在のキーとペアリング済みのメガネはそのまま使えます。",
    keyNotRevealable:
      "このキーは再表示できません。ペアリング済みのメガネはそのまま使えます。必要な場合は新しいキーを作成してください。",
    keyFailed: {
      create: "接続キーを作成できませんでした。しばらくしてからもう一度お試しください。",
      reveal: "接続キーを表示できませんでした。しばらくしてからもう一度お試しください。",
      withdraw: "接続キーを無効にできませんでした。しばらくしてからもう一度お試しください。",
    },
    keyUnconfirmed:
      "現在サインインしているアカウントで新しいキーを確認できませんでした。「状態を更新」を選んで現在のキーを確認してください。",
    keyMismatch:
      "このページを読み込んだ後にキーが変わったため、表示しませんでした。もう一度確認したので、「キーを表示」をもう一度選んでください。",
    statusFailed: "接続状態を読み込めませんでした。もう一度お試しください。",
    statusUnknown: "接続状態を確認できませんでした。",
    revokeAllFailed: "メガネの接続を解除できませんでした。もう一度お試しください。",
    revokedAll:
      "すべてのメガネの接続を解除し、接続キーを無効にしました。再びペアリングするには新しいキーを作成してください。",
    deleteFailed: "会話履歴を削除できませんでした。しばらくしてからもう一度お試しください。",
    deleted: (n) => `会話履歴から ${n} 件を削除しました。ペアリング済みのメガネと Dot の接続は変わりません。`,
  },
};
