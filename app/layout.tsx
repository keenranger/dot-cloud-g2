import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
