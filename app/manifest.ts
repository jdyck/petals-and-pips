import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Pips & Petals — A Dice Game",
    short_name: "Pips & Petals",
    description: "A dice game against the computer or with up to four players sharing one device.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f5f5",
    theme_color: "#f5f5f5",
    icons: [
      { src: "/icons/pips-and-petals-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/pips-and-petals-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
