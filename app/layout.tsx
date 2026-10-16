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
  title: "Pips & Petals — A Dice Game",
  description: "A dice game against the computer or with up to four players sharing one device.",
  applicationName: "Pips & Petals",
  formatDetection: { telephone: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Pips & Petals",
    statusBarStyle: "default",
  },
  // Next.js emits the generic capable tag; iPadOS 15 also needs Apple's tag.
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
