import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hearth — Shared money, made clear",
  description:
    "A shared financial operating system for couples. Track net worth, bills, spending, and savings opportunities together.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
