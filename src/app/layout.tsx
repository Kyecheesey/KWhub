import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SessionWrapper from "@/components/SessionWrapper";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "KWI ONE", template: "%s · KWI ONE" },
  applicationName: "KWI ONE",
  description: "KWI ONE — the internal workspace for KW Innovations",
  appleWebApp: { capable: true, title: "KWI ONE", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0a0f2a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
        <SessionWrapper>
          {children}
        </SessionWrapper>
      </body>
    </html>
  );
}
