import { cookies, headers } from "next/headers";
import { resolveLocale, type Locale } from "@/lib/locale";
import { LOCALE_COOKIE } from "./dashboard";

/**
 * The language of this request: an explicit `?lang=` wins, then the saved choice, then the browser's languages, then
 * English. Pages without search parameters (not-found) pass none.
 */
export async function requestLocale(
  searchParams?: Promise<Record<string, string | string[] | undefined>>,
): Promise<Locale> {
  return resolveLocale({
    query: searchParams ? (await searchParams).lang : undefined,
    cookie: (await cookies()).get(LOCALE_COOKIE)?.value,
    acceptLanguage: (await headers()).get("accept-language"),
  });
}
