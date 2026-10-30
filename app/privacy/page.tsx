import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage, { CONTACT_EMAIL, RELAY_ORIGIN } from "../components/policy-page";
import { PRODUCT_NAME } from "../i18n/dashboard";

export const metadata: Metadata = {
  title: `Privacy Notice — ${PRODUCT_NAME}`,
  description: "What Lens MCP for G2 processes, where it goes, how long the relay keeps it and how to erase it.",
};

export default function Privacy() {
  return (
    <PolicyPage title="Privacy Notice">
      <section aria-labelledby="who">
        <h2 id="who">Who we are</h2>
        <p>
          Lens MCP for G2 is an independent project published by <strong>keenranger</strong>. It consists of a companion
          app for Even Realities G2 glasses, distributed through Even Hub, and a relay website at{" "}
          <a href={RELAY_ORIGIN}>{RELAY_ORIGIN}</a>. Together they connect your G2 to your own ChatGPT Dot. It is not an
          official product of Even Realities, OpenAI or Soniox.
        </p>
        <p>
          Questions and privacy requests: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </section>

      <section aria-labelledby="audio">
        <h2 id="audio">Microphone audio</h2>
        <ul>
          <li>The companion uses only the G2 microphone. A manual recording lasts up to 30 seconds.</li>
          <li>
            “Hey dots” listening is on by default once the companion is paired and has a speech key. You can switch it
            off in the companion, and your choice is remembered on the phone. While it is on and the companion is
            running, the G2 microphone stays open so the cue can be detected.
          </li>
          <li>
            Cue detection runs on your phone. Audio heard before the cue is kept only in short, bounded buffers on the
            phone and is not sent anywhere.
          </li>
          <li>
            Speech after the cue, or a manual recording, is streamed from your phone directly to Soniox for
            transcription, using your own Soniox API key. Soniox handles that audio under your agreement with Soniox.
          </li>
          <li>
            Our relay never receives raw audio. Its server-side transcription endpoint is disabled and rejects requests
            before reading any audio.
          </li>
        </ul>
      </section>

      <section aria-labelledby="soniox-key">
        <h2 id="soniox-key">Your Soniox API key</h2>
        <p>
          You enter your own Soniox key on your phone. By default it is kept only in memory for the current app session.
          If you choose to remember it, it is saved in Even Hub app storage on that phone. You can clear or replace it
          at any time. The key is sent only to Soniox, never to our relay. The companion does not add its own encryption
          to a remembered key; it is as safe as your phone and the Even app.
        </p>
      </section>

      <section aria-labelledby="text">
        <h2 id="text">Messages, transcripts and replies</h2>
        <p>
          Typed messages, final transcripts, Dot replies and messages your Dot sends on its own are stored on the relay
          so they can be delivered between your G2 and ChatGPT. With them the relay stores your account identifier,
          message and device identifiers, timestamps and delivery state. Messages your Dot sends on its own are
          delivered to every device paired to your account. These messages can contain any personal information you
          choose to say or type.
        </p>
        <p>
          The companion keeps up to 100 recent replies in memory on the phone, and remembers your “Hey dots” and voice
          auto-send choices in Even Hub app storage.
        </p>
      </section>

      <section aria-labelledby="account">
        <h2 id="account">Sign-in, connection key and devices</h2>
        <ul>
          <li>
            You sign in to the relay website with ChatGPT. The hosting platform gives the relay an identifier for your
            account, which keeps your records separate from other users. Your ChatGPT session is not copied to the
            companion.
          </li>
          <li>
            Each account has at most one connection key. It has no expiry and can pair more than one device. The relay
            stores a SHA-256 hash of the key to look it up, and the key itself encrypted with AES-256-GCM under a server
            secret, so that you, signed in, can see it again later. This encryption protects against exposure of the
            database alone, not against a compromise of the server or its secret.
          </li>
          <li>
            The dashboard shows the key masked by default. It appears only after you choose “
            <span lang="ko">키 확인</span>”, can be copied only while shown, and is kept only in the page’s memory,
            never in browser storage.
          </li>
          <li>
            Creating a new key (“<span lang="ko">새 키 만들기</span>”) replaces the old one at once; withdrawing it (“
            <span lang="ko">연결 키 폐기</span>”) removes it. Devices that are already paired stay paired in both cases.
            “<span lang="ko">내 모든 기기 연결 해제</span>” removes the key and disconnects all of your devices.
          </li>
          <li>
            Devices paired before connection keys were introduced remain paired. The short-lived pairing codes used
            before then could not be shown again and have since expired.
          </li>
          <li>
            Pairing a device creates a device record and a device token. The relay stores the token only as a hash. The
            companion saves the token and the relay address in Even Hub app storage on the phone.
          </li>
          <li>
            When your Dot subscribes to events, the relay stores the subscription, its callback address and signing
            secret. A subscription lasts one hour by default (between one minute and one day) and can be cancelled.
          </li>
          <li>The relay keeps short-lived request counters to limit abuse.</li>
        </ul>
      </section>

      <section aria-labelledby="recipients">
        <h2 id="recipients">Where information goes</h2>
        <ul>
          <li>
            <strong>Our relay</strong>, hosted on the Sites platform used by this project: text, identifiers and
            connection records described above. Never audio or your Soniox key.
          </li>
          <li>
            <strong>Soniox</strong> (<code>stt-rt.soniox.com</code>): audio you submit for transcription and your key.
          </li>
          <li>
            <strong>ChatGPT (your Dot)</strong> and the MCP callback it registers: your messages and transcripts, and
            the replies it returns.
          </li>
          <li>
            <strong>Even Realities</strong> app and your phone’s operating system: they host the companion, connect the
            glasses’ microphone and display, and hold Even Hub app storage.
          </li>
        </ul>
        <p>
          Each provider processes data under its own terms and policies. The companion and the relay code in this
          project do not include analytics or advertising tools. We have not audited where providers store data, their
          logs or their backups.
        </p>
      </section>

      <section aria-labelledby="retention">
        <h2 id="retention">How long the relay keeps conversations</h2>
        <ul>
          <li>
            <strong>30-day cutoff.</strong> 30 days after a message, transcript or reply was created (UTC), the relay no
            longer shows, delivers, retries or answers it, whether or not it has yet been physically deleted.
          </li>
          <li>
            <strong>Erase now.</strong> Signed in to the relay website, you can erase all of your conversations at once
            with “<span lang="ko">대화 기록 영구 삭제</span>”. The content is deleted immediately. The relay keeps only
            a short, content-free marker for each erased item so that a late retry cannot store it again, and the
            companion clears its on-screen history the next time it checks for replies. Your devices, connection key and
            Dot subscription are not affected.
          </li>
          <li>
            <strong>Physical deletion.</strong> A daily cleanup is scheduled for 03:00 Korea time (Asia/Seoul). Each run
            permanently deletes up to 20,000 records that are past the 30-day cutoff; anything beyond that waits for a
            later run. Deletion can therefore happen up to about a day after the cutoff, and later if a run fails or a
            backlog builds up. The scheduled cleanup has not yet been observed running on its own, so we do not promise
            deletion on a particular day. Some expired records may also be deleted earlier when new messages are
            submitted.
          </li>
          <li>
            Content-free markers left by an erase or a cleanup are kept for 30 days and then removed by the same
            cleanup.
          </li>
          <li>
            The connection key is kept until you replace or withdraw it, or disconnect all devices. Expired codes,
            subscriptions and request counters stop working when they expire but are not deleted on a schedule.
          </li>
        </ul>
        <p>
          Disconnecting all devices removes their access but does not delete conversations; use “
          <span lang="ko">대화 기록 영구 삭제</span>” for that. “<span lang="ko">연결 해제</span>” in the companion
          clears the token saved on that phone only.
        </p>
        <p>
          The relay cannot delete what has already been sent to ChatGPT or Soniox, or what was already shown on your
          phone or glasses. Copies held by providers, and hosting and provider logs and backups, are outside these
          commitments.
        </p>
      </section>

      <section aria-labelledby="background">
        <h2 id="background">Locked phone and background use</h2>
        <p>
          While the glasses session stays active, the companion is designed to keep listening for “Hey dots”, recording
          and showing replies even when the phone is locked or the Even app is in the background. Whether it keeps
          running then depends on the Even app and your phone’s operating system. Closing the companion, disconnecting
          it or switching “Hey dots” off stops listening.
        </p>
      </section>

      <section aria-labelledby="security">
        <h2 id="security">Security</h2>
        <p>
          The companion talks to the relay and Soniox only over HTTPS and secure WebSockets. Device access uses
          per-device tokens; account actions require your ChatGPT sign-in and are limited to your own records; and key
          and pairing requests are rate limited. No system is perfectly secure, and we cannot guarantee that these
          measures prevent every misuse.
        </p>
      </section>

      <section aria-labelledby="changes">
        <h2 id="changes">Changes and contact</h2>
        <p>
          If this notice changes, the updated version and its effective date will be posted on this page. For questions
          or requests about your information, email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. See also
          the <Link href="/terms">Terms of Use</Link>.
        </p>
      </section>
    </PolicyPage>
  );
}
