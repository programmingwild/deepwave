import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DEEPWAVE — Underwater Environmental Intelligence",
  description:
    "Underwater Environmental Intelligence & Pollution Early Warning System. Edge AI monitoring command center for the DW-01 survey rover.",
  manifest: "./manifest.json",
  icons: {
    icon: [
      { url: "./icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "./icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "./icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DEEPWAVE",
  },
};

export const viewport: Viewport = {
  themeColor: "#030812",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrains.variable} font-sans`}>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}