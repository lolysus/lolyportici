import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { brandConfig } from "@/config/brand";
import { getRequestOrigin } from "@/lib/public-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// metadataBase resolves every relative canonical/og URL in the app. YUKO and
// KouSushi live on separate domains, so it has to reflect the domain the
// request actually arrived on rather than one fixed value — otherwise every
// page canonicalizes to the same host regardless of which one Google is
// actually crawling.
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(await getRequestOrigin()),
    title: { default: `${brandConfig.platformName} · ${brandConfig.companyName}`, template: `%s · ${brandConfig.platformName}` },
    description: "Prenotazioni online dei ristoranti YUKO e KouSushi, ognuno con la propria sala e il proprio servizio.",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><Providers>{children}</Providers></body>
    </html>
  );
}
