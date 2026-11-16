"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, LogIn, LogOut } from "lucide-react";
import { useWatchlist } from "@/context/WatchlistContext";

const NAV_ITEMS = [
  { href: "/", label: "Discover" },
  { href: "/watchlist", label: "Bucket List" },
  { href: "/benchmarks", label: "Benchmarks" },
  { href: "/about", label: "About" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, savedIds, signInWithGoogle, signOut, resetEntry } =
    useWatchlist();

  return (
    <header className="sticky top-0 z-40 border-b border-[#1E2230] bg-[#07080B]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          onClick={() => {
            if (!user) resetEntry();
          }}
          className="flex items-center transition hover:opacity-90"
        >
          <span
            style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
            className="text-2xl font-bold tracking-tight text-white"
          >
            Lumière
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV_ITEMS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-white text-black shadow-sm"
                    : "text-zinc-400 hover:bg-[#12151E] hover:text-white"
                }`}
              >
                {label === "Bucket List" && (
                  <Bookmark className="h-3.5 w-3.5" />
                )}
                {label}
                {label === "Bucket List" && savedIds.length > 0 && (
                  <span
                    className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none ${
                      active
                        ? "bg-black text-[#EAB308]"
                        : "bg-[#EAB308]/20 text-[#EAB308]"
                    }`}
                  >
                    {savedIds.length}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="ml-2 border-l border-[#1E2230] pl-2 sm:pl-3">
            {user ? (
              <button
                type="button"
                onClick={signOut}
                title={user.email || "Signed in"}
                className="flex items-center gap-1.5 rounded-full border border-[#1E2230] bg-[#0F1117] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white active:scale-95"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="hidden sm:inline">
                  {user.user_metadata?.full_name?.split(" ")[0] || "Account"}
                </span>
                <LogOut className="h-3.5 w-3.5 text-zinc-400" />
              </button>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="flex items-center gap-1.5 rounded-full bg-[#EAB308] px-3.5 py-1.5 text-xs font-semibold text-black transition hover:bg-[#FACC15] active:scale-95"
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign in
              </button>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
