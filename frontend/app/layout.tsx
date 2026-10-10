import type { Metadata } from "next";
import "./globals.css";
import AuthGate from "@/components/auth/AuthGate";

export const metadata: Metadata = {
  title: "UrbanTrack AI — Multi-Camera Vehicle Intelligence",
  description:
    "Vehicle perception, cross-camera association evidence, trajectory reconstruction and mobility analytics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col"><AuthGate>{children}</AuthGate></body>
    </html>
  );
}
