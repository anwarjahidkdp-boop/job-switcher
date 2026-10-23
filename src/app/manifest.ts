import type { MetadataRoute } from "next";

/** Lets phones and desktops install JobPao as an app (home-screen icon, opens full screen). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JobPao: your job assistant",
    short_name: "JobPao",
    description: "Finds your best-matched jobs, prepares every application and gets you ready for the interview.",
    start_url: "/inbox",
    id: "/",
    scope: "/",
    related_applications: [{ platform: "webapp", url: "https://jobpao.app/manifest.webmanifest" }],
    display: "standalone",
    background_color: "#F4F6FA",
    theme_color: "#FFFFFF",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
