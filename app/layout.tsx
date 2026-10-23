import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "G2 Bridge — Even G2와 Dot 연결",
  description: "Even Hub의 음성을 ChatGPT Dot에 전하고 답변을 G2 화면으로 연결합니다.",
  other: {
    "codex-preview": "development",
  },
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
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
