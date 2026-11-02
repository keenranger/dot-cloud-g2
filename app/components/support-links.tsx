import { ISSUES_URL, REPO_URL } from "@/app/i18n/product";
import type { Copy } from "@/app/i18n/dashboard";

// Fixed public destinations, opened only when chosen. Nothing about the visitor, page or session is added, and no
// referrer is sent.
export default function SupportLinks({ t }: { t: Copy["page"] }) {
  return (
    <nav className="support-links" aria-label={t.support}>
      <a href={REPO_URL} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
        {t.supportGuide}
        <span aria-hidden="true"> ↗</span>
        <span className="sr-only"> {t.newTab}</span>
      </a>
      <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
        {t.supportIssues}
        <span aria-hidden="true"> ↗</span>
        <span className="sr-only"> {t.newTab}</span>
      </a>
    </nav>
  );
}
