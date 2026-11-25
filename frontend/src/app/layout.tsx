import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { WatchlistProvider } from "@/context/WatchlistContext";
import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Lumière — Discover Cinema by Mood, Story & Nuance",
  description:
    "Intelligent movie discovery powered by hybrid semantic search, natural-language filters, and personalized watchlist recommendations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${playfair.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen w-full max-w-full flex-col overflow-x-clip bg-[#07080B] font-sans text-zinc-100 antialiased selection:bg-[#EAB308]/30 selection:text-[#FDE047]">
        <WatchlistProvider>
          <Navbar />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
            {children}
          </main>
          <Footer />
        </WatchlistProvider>
      </body>
    </html>
  );
}
