import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lucky Five — A Dice Game",
  description: "A one-player dice game against Milo, your computer opponent.",
  applicationName: "Lucky Five",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Lucky Five",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon",
    apple: "/apple-icon",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f0e4",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
