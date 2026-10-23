import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { CV_SCREEN_CSS } from "@/lib/cv/styles";
import { InstallApp } from "@/components/InstallApp";
import { RouteProgress } from "@/components/RouteProgress";
import { Suspense } from "react";
import "./globals.css";

const inter = localFont({ src: "./fonts/inter-latin.woff2", weight: "400 600", variable: "--font-inter", display: "swap" });
const manrope = localFont({ src: "./fonts/manrope-latin.woff2", weight: "600 800", variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: { default: "JobPao", template: "%s · JobPao" },
  description: "Your personal AI career agent. Upload your CV once; JobPao improves it, finds matching jobs in Bangladesh and abroad, prepares applications and keeps you ahead of deadlines.",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "JobPao", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#FFFFFF" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={`${inter.variable} ${manrope.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: CV_SCREEN_CSS }} />
      </head>
      <body><Suspense fallback={null}><RouteProgress /></Suspense>{children}<InstallApp /></body>
    </html>
  );
}
