import { Charm, Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClientInit } from "@/components/client-init";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});
const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});
const cormorant = Cormorant_Garamond({
    variable: "--font-serif-display",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    style: ["normal", "italic"],
});
const charm = Charm({
    variable: "--font-charm",
    subsets: ["latin"],
    weight: ["400", "700"],
});

export const metadata = {
    title: {
        default: "CampusFlow",
        template: "%s | CampusFlow",
    },
    description: "Unified Campus Resource, Laboratory and Facility Booking Platform",
};

export default function RootLayout({ children, }) {
    return (
      <html lang="en" data-scroll-behavior="smooth" className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} ${charm.variable} h-full antialiased`}>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Charm:wght@400;700&display=swap" rel="stylesheet" />
        </head>
        <body className="min-h-full">
          <ClientInit />
          {children}
        </body>
      </html>
    );
}
