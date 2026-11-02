import Link from "next/link";
import { CONTACT_EMAIL, RELAY_ORIGIN } from "../../components/policy-page";
import { copy, policyPath } from "../../i18n/dashboard";

// Japanese translation of the English Terms of Use in ../page.tsx; same sections, lists and facts.
const privacy = copy.ja.page.privacy;

export const description = "Lens MCP for G2 が提供するもの、あなたに必要なもの、その制限。";

export default function Body() {
  return (
    <>
      <p>
        この規約は、<strong>keenranger</strong> が公開している Lens MCP for G2 のコンパニオンアプリと、
        <a href={RELAY_ORIGIN}>{RELAY_ORIGIN}</a> にあるリレーウェブサイトに適用されます。
        <Link href={policyPath("privacy", "ja")}>{privacy}</Link>とあわせてお読みください。
      </p>

      <section aria-labelledby="service">
        <h2 id="service">1. サービス</h2>
        <p>
          Lens MCP for G2 は、MCP を通じて Even Realities G2 メガネをあなた自身の ChatGPT Dot
          に接続します。あなたが話したり入力したりした内容を Dot に渡し、その返事をメガネに表示します。汎用の MCP
          クライアントではなく、すべての MCP サーバーやエージェントで動作することを約束するものではありません。
        </p>
      </section>

      <section aria-labelledby="needs">
        <h2 id="needs">2. 必要なもの</h2>
        <ul>
          <li>G2 メガネと、互換性のある Even アプリ（バージョン 2.2.10 以降）を入れたスマートフォン。</li>
          <li>ネットワーク接続と、リレーに Dot を接続した ChatGPT アカウント。</li>
          <li>音声入力には、ご自身の Soniox アカウントと API キー。</li>
        </ul>
      </section>

      <section aria-labelledby="accounts">
        <h2 id="accounts">3. あなたのアカウント、キー、料金</h2>
        <p>
          このサービスで使うアカウントとキーはあなたが管理し、それらを使う権利を持っている必要があります。ChatGPT、Soniox、Even
          Realities のサービスはそれぞれの規約に基づいて提供され、文字起こしのための Soniox
          の利用料など、それらの料金はあなたの負担です。このアプリには有料の文字起こしクレジットは含まれず、提供者のアカウントを代わりに作成することもありません。
        </p>
        <p>
          接続キーはパスワードと同じように扱ってください。キーを持っている人は誰でも、あなたが新しいキーを作成するか無効にするまで、新しいデバイスをあなたのアカウントにペアリングできます。すべてのデバイスの接続はリレーウェブサイトから解除できます。
        </p>
      </section>

      <section aria-labelledby="limits">
        <h2 id="limits">4. 制限と安全な利用</h2>
        <ul>
          <li>
            文字起こしには誤りが含まれることがあり、Dot の返事が間違っていることもあります。頼る前に確認してください。
          </li>
          <li>緊急時や、医療・法律・金融に関する専門家の助言の代わりとしてこのサービスを使わないでください。</li>
          <li>メガネを見たり操作したりするのは、安全なときだけにしてください。</li>
          <li>
            スマートフォンのロック中やバックグラウンドでの動作は、Even
            アプリとスマートフォンのオペレーティングシステムに依存し、保証されません。
          </li>
          <li>これは独立したプロジェクトです。変更、中断、終了することがあります。</li>
        </ul>
      </section>

      <section aria-labelledby="use">
        <h2 id="use">5. 許容される利用</h2>
        <p>
          法律に違反する目的、他人の記録やデバイスにアクセスする目的、またはリレーやその接続先のサービスを妨害する目的で、このサービスを使わないでください。
        </p>
      </section>

      <section aria-labelledby="exit">
        <h2 id="exit">6. 利用の停止</h2>
        <p>
          「Hey dots」のオフ、録音の停止、Soniox
          キーの消去、コンパニオンアプリの接続解除、接続キーの無効化、すべてのデバイスの接続解除、会話の消去は、
          <Link href={policyPath("privacy", "ja")}>{privacy}</Link>
          に記載のとおり、いつでも行えます。他の提供者が保持するデータは、引き続きそれぞれの管理の対象です。
        </p>
      </section>

      <section aria-labelledby="independence">
        <h2 id="independence">7. 独立性</h2>
        <p>
          このプロジェクトは Even Realities、OpenAI、Soniox
          と提携しておらず、承認も受けていません。これらの名称は、その製品やサービスとの互換性を説明するためだけに使用しています。
        </p>
      </section>

      <section aria-labelledby="contact">
        <h2 id="contact">8. 変更と連絡先</h2>
        <p>
          この規約が変更された場合は、更新版とその発効日をこのページに掲載します。ご質問:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>。
        </p>
      </section>
    </>
  );
}
