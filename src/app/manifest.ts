import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KWI ONE",
    short_name: "KWI ONE",
    description: "KWI ONE — the internal hub for KW Innovations: clients, pipeline, boards and team.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0f2a",
    theme_color: "#0a0f2a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
