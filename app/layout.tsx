import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PwaRegistrar } from "@/components/PwaRegistrar";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediDrone — Emergency SOS",
  description:
    "One-tap SOS for out-of-hospital cardiac arrest. Sends your live location to the MediDrone emergency dispatch service.",
  manifest: "/manifest.webmanifest",
  applicationName: "MediDrone",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MediDrone",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#dc2626",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-slate-950 text-slate-100 antialiased">
        {children}
        <PwaRegistrar />
      </body>
    </html>
  );
}
