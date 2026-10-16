import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Nunito_Sans } from "next/font/google";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-nunito-sans",
});

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-cormorant",
});

export const metadata: Metadata = {
  title: "Petals & Pips — A Dice Game",
  description: "A dice game against the computer or with up to four players sharing one device.",
  applicationName: "Petals & Pips",
  formatDetection: { telephone: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Petals & Pips",
    statusBarStyle: "default",
  },
  // Next.js emits the generic capable tag; iPadOS 15 also needs Apple's tag.
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: "/icon",
    apple: { url: "/apple-icon", sizes: "180x180", type: "image/png" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${nunitoSans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
