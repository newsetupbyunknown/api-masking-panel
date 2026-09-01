import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "API Masking Panel",
  description: "Secure API masking and control panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
