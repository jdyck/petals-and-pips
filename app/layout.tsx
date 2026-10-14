import type { Metadata, Viewport } from "next";
import { Lora, Nunito_Sans } from "next/font/google";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-nunito-sans",
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
  variable: "--font-lora",
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
  icons: {
    icon: "/icon",
    apple: { url: "/apple-icon", sizes: "180x180", type: "image/png" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f5f5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${nunitoSans.variable} ${lora.variable}`}>
      <body>{children}</body>
    </html>
  );
}
