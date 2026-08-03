import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KW | Innovations Hub",
    short_name: "KW Hub",
    description: "The internal hub for KW Innovations — clients, pipeline, boards and team.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#4f46e5",
    icons: [
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
