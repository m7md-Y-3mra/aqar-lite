import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/shared/components/providers";
import "./globals.css";

// Self-hosted (SIL OFL 1.1, see src/shared/fonts/ofl.txt) so the build needs no network.
const ibmPlexSansArabic = localFont({
  src: [
    { path: "../shared/fonts/ibm-plex-sans-arabic-regular.woff2", weight: "400", style: "normal" },
    { path: "../shared/fonts/ibm-plex-sans-arabic-medium.woff2", weight: "500", style: "normal" },
    { path: "../shared/fonts/ibm-plex-sans-arabic-bold.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-arabic",
});

export const metadata: Metadata = {
  title: "عقار لايت",
  description: "نظام بيع الوحدات العقارية بالتقسيط",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={ibmPlexSansArabic.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
