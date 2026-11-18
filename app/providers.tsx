"use client";

import Link from "next/link";
import { LinkProvider } from "@astryxdesign/core/Link";
import { Theme } from "@astryxdesign/core/theme";
import { matchaTheme } from "@astryxdesign/theme-matcha/built";

// Matcha's tokens use light-dark(), so "system" follows the reader's color scheme.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Theme theme={matchaTheme} mode="system">
      <LinkProvider component={Link}>{children}</LinkProvider>
    </Theme>
  );
}
