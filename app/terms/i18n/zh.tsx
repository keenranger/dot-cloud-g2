import Link from "next/link";
import { CONTACT_EMAIL, RELAY_ORIGIN } from "../../components/policy-page";
import { copy, policyPath } from "../../i18n/dashboard";

// Simplified Chinese translation of the English Terms of Use in ../page.tsx; same sections, lists and facts.
const privacy = copy.zh.page.privacy;

export const description = "Lens MCP for G2 提供什么、需要你准备什么，以及它的限制。";

export default function Body() {
  return (
    <>
      <p>
        本条款适用于由 <strong>keenranger</strong> 发布的 Lens MCP for G2 配套应用和位于{" "}
        <a href={RELAY_ORIGIN}>{RELAY_ORIGIN}</a> 的中继网站。请与
        <Link href={policyPath("privacy", "zh")}>{privacy}</Link>一并阅读。
      </p>

      <section aria-labelledby="service">
        <h2 id="service">1. 服务</h2>
        <p>
          Lens MCP for G2 通过 MCP 将你的 Even Realities G2 眼镜连接到你自己的 ChatGPT
          Dot：它把你说的或输入的内容传给你的 Dot，并在眼镜上显示它的回复。它不是通用的 MCP 客户端，也不承诺能与所有 MCP
          服务器或智能体配合使用。
        </p>
      </section>

      <section aria-labelledby="needs">
        <h2 id="needs">2. 你需要准备的</h2>
        <ul>
          <li>G2 眼镜，以及装有兼容 Even 应用（2.2.10 或更高版本）的手机。</li>
          <li>网络连接，以及一个已将 Dot 连接到中继的 ChatGPT 账户。</li>
          <li>如需语音输入，需要你自己的 Soniox 账户和 API 密钥。</li>
        </ul>
      </section>

      <section aria-labelledby="accounts">
        <h2 id="accounts">3. 你的账户、密钥和费用</h2>
        <p>
          你掌控与本服务一起使用的账户和密钥，并且必须有权使用它们。ChatGPT、Soniox 和 Even Realities
          的服务依据其各自的条款提供，由此产生的任何费用（例如用于转写的 Soniox
          用量）由你承担。本应用不含付费转写额度，也不会为你创建提供方账户。
        </p>
        <p>
          请像对待密码一样对待你的连接密钥。任何持有它的人都可以将新设备配对到你的账户，直到你创建新密钥或撤销它为止。你可以在中继网站上断开你的所有设备。
        </p>
      </section>

      <section aria-labelledby="limits">
        <h2 id="limits">4. 限制与安全使用</h2>
        <ul>
          <li>转写可能有错误，Dot 的回复也可能不正确。在依赖它们之前请先核实。</li>
          <li>请勿将本服务用于紧急情况，也不要用它代替专业的医疗、法律或财务建议。</li>
          <li>只在安全的情况下查看眼镜或与之交互。</li>
          <li>手机锁定或在后台时的运行取决于 Even 应用和你手机的操作系统，不作保证。</li>
          <li>这是一个独立项目。它可能会变更、中断或停止提供。</li>
        </ul>
      </section>

      <section aria-labelledby="use">
        <h2 id="use">5. 可接受的使用</h2>
        <p>请勿利用本服务违反法律、访问他人的记录或设备，或干扰中继及其连接的服务。</p>
      </section>

      <section aria-labelledby="exit">
        <h2 id="exit">6. 停止使用</h2>
        <p>
          你可以随时关闭“Hey dots”、停止录音、清除你的 Soniox
          密钥、断开配套应用、撤销你的连接密钥、断开所有设备并删除你的对话，具体见
          <Link href={policyPath("privacy", "zh")}>{privacy}</Link>。其他提供方持有的数据仍受其自身控制措施的约束。
        </p>
      </section>

      <section aria-labelledby="independence">
        <h2 id="independence">7. 独立性</h2>
        <p>
          本项目与 Even Realities、OpenAI 或 Soniox
          无关联，也未获得它们的认可。使用它们的名称仅为说明与其产品和服务的兼容性。
        </p>
      </section>

      <section aria-labelledby="contact">
        <h2 id="contact">8. 变更与联系方式</h2>
        <p>
          如果本条款发生变更，更新后的版本及其生效日期将发布在本页面。问题：
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>。
        </p>
      </section>
    </>
  );
}
