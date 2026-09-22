import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DaySmash - Sistem Rotasi Pertandingan Badminton",
  description: "Aplikasi rotasi pertandingan badminton ganda otomatis, adil, anti-monoton dengan spreadsheet view.",
  icons: {
    icon: "/photo-logo-daysmash.jpg",
    shortcut: "/photo-logo-daysmash.jpg",
    apple: "/photo-logo-daysmash.jpg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
