import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/app/Providers";
import { Rubik } from "next/font/google";

// Self-hosted at build time (no runtime request to Google). Hebrew + Latin.
const rubik = Rubik({ subsets: ["hebrew", "latin"], variable: "--font-rubik", display: "swap" });

export const metadata: Metadata = {
  title: { default: "HOP — העיר שלך. הופ אחד.", template: "%s · HOP" },
  description: "HOP — הזמנת נסיעה פשוטה, מהירה ושקופה. רואים את המחיר לפני ההזמנה.",
  applicationName: "HOP",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/apple-icon.svg" },
  appleWebApp: { capable: true, title: "HOP", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F6FA" },
    { media: "(prefers-color-scheme: dark)", color: "#F4F6FA" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} h-full antialiased`} data-scroll-behavior="smooth">
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
