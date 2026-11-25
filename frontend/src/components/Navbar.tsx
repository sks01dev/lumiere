"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, LogIn, LogOut, Menu, X } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen]);

  const accountName =
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "Account";

  return (
    <header className="sticky top-0 z-40 border-b border-[#1E2230] bg-[#07080B]/95 backdrop-blur-md">
      <div
        ref={menuContainerRef}
        className="relative mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6"
      >
        <Link
          href="/"
          onClick={() => {
            setMenuOpen(false);
            if (!user) resetEntry();
          }}
          className="flex shrink-0 items-center transition hover:opacity-90"
        >
          <span
            style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
            className="text-2xl font-bold tracking-tight text-white"
          >
            Lumière
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-1.5 md:flex">
          {NAV_ITEMS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-white text-black shadow-sm"
                    : "text-zinc-400 hover:bg-[#12151E] hover:text-white"
                }`}
              >
                {label === "Bucket List" && <Bookmark className="h-3.5 w-3.5" />}
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

          <div className="ml-2 flex shrink-0 items-center border-l border-[#1E2230] pl-3">
            {user ? (
              <button
                type="button"
                onClick={signOut}
                title={user.email || "Signed in"}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#1E2230] bg-[#0F1117] px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white active:scale-95"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>{accountName}</span>
                <LogOut className="h-3.5 w-3.5 text-zinc-400" />
              </button>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#EAB308] px-3.5 py-1.5 text-xs font-semibold text-black transition hover:bg-[#FACC15] active:scale-95"
              >
                <LogIn className="h-3.5 w-3.5" />
                Sign in
              </button>
            )}
          </div>
        </nav>

        {/* Mobile hamburger button (< 768px) */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#1E2230] bg-[#0F1117] text-zinc-200 transition hover:border-zinc-600 hover:text-white active:scale-95"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="absolute right-4 top-full z-50 mt-2 w-60 rounded-2xl border border-[#1E2230] bg-[#0B0D12]/98 p-2 shadow-2xl backdrop-blur-md md:hidden">
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map(({ href, label }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-white text-black"
                        : "text-zinc-200 hover:bg-[#12151E] hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {label === "Bucket List" && (
                        <Bookmark className="h-4 w-4" />
                      )}
                      {label}
                    </span>
                    {label === "Bucket List" && savedIds.length > 0 && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
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
            </div>

            <div className="my-2 border-t border-[#1E2230]" />

            {user ? (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void signOut();
                }}
                className="flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-zinc-200 transition hover:bg-[#12151E] hover:text-white"
              >
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>{accountName} · Sign out</span>
                </span>
                <LogOut className="h-4 w-4 text-zinc-400" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void signInWithGoogle();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#EAB308] px-3.5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#FACC15]"
              >
                <LogIn className="h-4 w-4" />
                Sign in with Google
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
