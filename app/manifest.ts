import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Lucky Five — A Dice Game",
    short_name: "Lucky Five",
    description: "A one-player dice game against Milo, your computer opponent.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f0e4",
    theme_color: "#f5f0e4",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
