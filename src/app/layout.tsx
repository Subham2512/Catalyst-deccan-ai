import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Catalyst — AI Talent Scouting Agent",
  description: "AI agent that discovers matching candidates, simulates outreach, and delivers a ranked shortlist scored on Match + Interest.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
