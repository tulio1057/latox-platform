import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "LATox — Liga Acadêmica de Toxicologia",
  description: "Liga Acadêmica de Toxicologia: ensino, pesquisa e extensão em toxicologia.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "LATox — Liga Acadêmica de Toxicologia",
    images: [{ url: "/brand/og-default.jpg", width: 1200, height: 630, alt: "Logo da LATox" }],
  },
};

export const viewport: Viewport = { themeColor: "#26351B", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${cormorant.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
