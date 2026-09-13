import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Open Mat Atlas — every open mat on one globe",
  description:
    "A spinning globe of open mats worldwide. Find somewhere to roll when you travel, or put your academy's open mat on the map.",
  metadataBase: new URL("https://openmatatlas.com"),
  openGraph: {
    title: "Open Mat Atlas",
    description: "Every open mat on one globe. Find a session, or add yours.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
