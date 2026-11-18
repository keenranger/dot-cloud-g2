import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Dots Lens for G2 — ChatGPT Dot on your G2 glasses",
  description: "Talk to your ChatGPT Dot from Even G2 and read the replies on your glasses.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The theme attribute is set on the server too, so the page background and tokens apply before hydration.
    <html lang="en" data-astryx-theme="matcha">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
