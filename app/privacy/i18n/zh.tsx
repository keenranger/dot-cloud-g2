import Link from "next/link";
import { CONTACT_EMAIL, RELAY_ORIGIN } from "../../components/policy-page";
import { copy, policyPath } from "../../i18n/dashboard";

// Simplified Chinese translation of the English Privacy Notice in ../page.tsx; same sections, lists and facts.
const d = copy.zh.dashboard;
// The companion's disconnect button (even-app/src/messages/zh.ts).
const companionDisconnect = "断开并忘记此连接";

export const description = "Lens MCP for G2 处理哪些信息、发送到哪里、中继保留多久，以及如何删除。";

export default function Body() {
  return (
    <>
      <section aria-labelledby="who">
        <h2 id="who">我们是谁</h2>
        <p>
          Lens MCP for G2 是由 <strong>keenranger</strong> 发布的独立项目。它由一款通过 Even Hub 分发、适用于 Even
          Realities G2 眼镜的配套应用，以及位于 <a href={RELAY_ORIGIN}>{RELAY_ORIGIN}</a> 的中继网站组成。二者共同把你的
          G2 连接到你自己的 ChatGPT Dot。它不是 Even Realities、OpenAI 或 Soniox 的官方产品。
        </p>
        <p>
          问题和隐私请求：<a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>。
        </p>
      </section>

      <section aria-labelledby="audio">
        <h2 id="audio">麦克风音频</h2>
        <ul>
          <li>配套应用只使用 G2 的麦克风。一次手动录音最长 30 秒。</li>
          <li>
            配套应用完成配对并设置语音密钥后，“Hey
            dots”聆听默认开启。你可以在配套应用中关闭它，你的选择会保存在手机上。在它开启且配套应用运行期间，G2
            麦克风会保持打开，以便检测唤醒词。
          </li>
          <li>
            唤醒词检测在你的手机上进行。唤醒词之前听到的音频只保存在手机上短暂且有上限的缓冲区中，不会发送到任何地方。
          </li>
          <li>
            唤醒词之后的语音或手动录音，会使用你自己的 Soniox API 密钥，从你的手机直接流式传输到 Soniox 进行转写。Soniox
            依据你与 Soniox 的协议处理这些音频。
          </li>
          <li>我们的中继从不接收原始音频。它的服务器端转写接口已停用，会在读取任何音频之前拒绝请求。</li>
        </ul>
      </section>

      <section aria-labelledby="soniox-key">
        <h2 id="soniox-key">你的 Soniox API 密钥</h2>
        <p>
          你在手机上输入自己的 Soniox
          密钥。默认情况下，它只在当前应用会话期间保存在内存中。如果你选择记住它，它会保存在该手机的 Even Hub
          应用存储中。你可以随时清除或替换它。密钥只发送给
          Soniox，从不发送到我们的中继。配套应用不会为记住的密钥另外加密；它的安全性取决于你的手机和 Even 应用。
        </p>
      </section>

      <section aria-labelledby="text">
        <h2 id="text">消息、转写和回复</h2>
        <p>
          输入的消息、最终转写、Dot 的回复以及你的 Dot 主动发送的消息会存储在中继上，以便在你的 G2 和 ChatGPT
          之间传递。中继还会一并存储你的账户标识符、消息和设备标识符、时间戳和投递状态。你的 Dot
          主动发送的消息会投递到与你账户配对的每台设备。这些消息可能包含你选择说出或输入的任何个人信息。
        </p>
        <p>
          配套应用会在手机内存中保留最多 100 条最近的回复，并在 Even Hub 应用存储中记住你对“Hey
          dots”和语音自动发送的选择。
        </p>
      </section>

      <section aria-labelledby="account">
        <h2 id="account">登录、连接密钥和设备</h2>
        <ul>
          <li>
            你使用 ChatGPT 登录中继网站。托管平台会向中继提供你账户的标识符，使你的记录与其他用户分开。你的 ChatGPT
            会话不会复制到配套应用。
          </li>
          <li>
            每个账户最多有一个连接密钥。它没有有效期，并且可以配对多台设备。中继会存储密钥的 SHA-256
            哈希值用于查找，并在服务器密钥下用 AES-256-GCM
            加密存储密钥本身，以便你登录后可以再次查看。这种加密可以防止仅数据库泄露的情况，但不能防止服务器或其密钥被攻破。
          </li>
          <li>
            控制面板默认以遮蔽方式显示密钥。只有在你选择“{d.showKey}
            ”后才会显示，只能在显示期间复制，并且只保存在页面内存中，从不保存在浏览器存储中。
          </li>
          <li>
            创建新密钥（“{d.createNewKey}”）会立即替换旧密钥；撤销（“{d.revokeKey}
            ”）会删除它。两种情况下，已配对的设备都保持配对。“{d.revokeAll}”会删除密钥并断开你的所有设备。
          </li>
          <li>在引入连接密钥之前配对的设备仍保持配对。此前使用的短时配对码无法再次显示，并且现已过期。</li>
          <li>
            配对设备会创建一条设备记录和一个设备令牌。中继只以哈希形式存储令牌。配套应用会把令牌和中继地址保存在手机上的
            Even Hub 应用存储中。
          </li>
          <li>
            当你的 Dot
            订阅事件时，中继会存储该订阅及其回调地址和签名密钥。订阅默认持续一小时（介于一分钟到一天之间），并且可以取消。
          </li>
          <li>中继会保留短时的请求计数器，以限制滥用。</li>
        </ul>
      </section>

      <section aria-labelledby="recipients">
        <h2 id="recipients">信息去向</h2>
        <ul>
          <li>
            <strong>我们的中继</strong>，托管在本项目使用的 Sites
            平台上：上文所述的文本、标识符和连接记录。从不包括音频或你的 Soniox 密钥。
          </li>
          <li>
            <strong>Soniox</strong>（<code>stt-rt.soniox.com</code>）：你提交转写的音频以及你的密钥。
          </li>
          <li>
            <strong>ChatGPT（你的 Dot）</strong>及其注册的 MCP 回调：你的消息和转写，以及它返回的回复。
          </li>
          <li>
            <strong>Even Realities</strong> 应用和你手机的操作系统：它们承载配套应用，连接眼镜的麦克风和显示屏，并保存
            Even Hub 应用存储。
          </li>
        </ul>
        <p>
          每个提供方都依据其自己的条款和政策处理数据。本项目的配套应用和中继代码不包含分析或广告工具。我们没有审核提供方在哪里存储数据、其日志或其备份。
        </p>
      </section>

      <section aria-labelledby="retention">
        <h2 id="retention">中继保留对话的时长</h2>
        <ul>
          <li>
            <strong>30 天截止。</strong>消息、转写或回复创建（UTC）30
            天后，中继不再显示、投递、重试或回复它，无论它是否已被物理删除。
          </li>
          <li>
            <strong>立即删除。</strong>登录中继网站后，你可以通过“{d.deleteForever}
            ”一次性删除你的所有对话。内容会立即删除。中继只为每个已删除项目保留一个简短、不含内容的标记，以免迟到的重试再次存储它；配套应用会在下一次检查回复时清除屏幕上的历史记录。你的设备、连接密钥和
            Dot 订阅不受影响。
          </li>
          <li>
            <strong>物理删除。</strong>每日清理计划在韩国时间（Asia/Seoul）03:00 进行。每次运行最多永久删除 20,000
            条已超过 30
            天截止的记录；超出部分等待之后的运行。因此删除可能在截止后约一天内发生，如果某次运行失败或出现积压，则会更晚。尚未观察到计划清理自行运行，因此我们不承诺在某一天删除。提交新消息时，部分已过期记录也可能会被提前删除。
          </li>
          <li>删除或清理留下的不含内容的标记会保留 30 天，然后由同一清理移除。</li>
          <li>
            连接密钥会保留到你替换或撤销它，或断开所有设备为止。过期的配对码、订阅和请求计数器到期后即停止生效，但不会按计划删除。
          </li>
        </ul>
        <p>
          断开所有设备会移除它们的访问权限，但不会删除对话；如需删除，请使用“{d.deleteForever}”。配套应用中的“
          {companionDisconnect}”只会清除保存在该手机上的令牌。
        </p>
        <p>
          中继无法删除已经发送到 ChatGPT 或 Soniox
          的内容，也无法删除已经显示在你手机或眼镜上的内容。提供方持有的副本，以及托管和提供方的日志与备份，不在这些承诺范围内。
        </p>
      </section>

      <section aria-labelledby="background">
        <h2 id="background">手机锁定和后台使用</h2>
        <p>
          在眼镜会话保持活动期间，配套应用的设计是即使手机锁定或 Even 应用处于后台，也继续聆听“Hey
          dots”、录音并显示回复。届时它是否继续运行，取决于 Even
          应用和你手机的操作系统。关闭配套应用、断开其连接或关闭“Hey dots”都会停止聆听。
        </p>
      </section>

      <section aria-labelledby="security">
        <h2 id="security">安全</h2>
        <p>
          配套应用只通过 HTTPS 和安全 WebSocket 与中继和 Soniox 通信。设备访问使用每台设备各自的令牌；账户操作需要你的
          ChatGPT
          登录，且仅限于你自己的记录；密钥和配对请求设有频率限制。没有任何系统是绝对安全的，我们无法保证这些措施能防止所有滥用。
        </p>
      </section>

      <section aria-labelledby="changes">
        <h2 id="changes">变更与联系方式</h2>
        <p>
          如果本声明发生变更，更新后的版本及其生效日期将发布在本页面。如对你的信息有任何问题或请求，请发送电子邮件至{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>。另请参阅
          <Link href={policyPath("terms", "zh")}>{copy.zh.page.terms}</Link>。
        </p>
      </section>
    </>
  );
}
