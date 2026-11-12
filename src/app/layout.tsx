import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { Providers } from "@/shared/components/providers";
import "./globals.css";

const font = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-arabic",
});

export const metadata: Metadata = {
  title: "عقار لايت",
  description: "نظام بيع الوحدات العقارية بالتقسيط",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={font.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
