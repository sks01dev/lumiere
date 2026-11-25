"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface MobileNavMenuProps {
  bucketCount?: number;
  onSelectView?: (view: "discover" | "bucket" | "benchmarks") => void;
  isSignedIn?: boolean;
  onAuthAction?: () => void;
}

export default function MobileNavMenu({
  bucketCount,
  onSelectView,
  isSignedIn = false,
  onAuthAction,
}: MobileNavMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const handleNav = (view: "discover" | "bucket" | "benchmarks", href: string) => {
    setOpen(false);
    if (onSelectView) {
      onSelectView(view);
    } else if (typeof window !== "undefined") {
      window.location.assign(href);
    }
  };

  return (
    <div ref={menuRef} className="relative md:hidden shrink-0">
      <button
        type="button"
        aria-label="Toggle navigation menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700/80 bg-zinc-900 text-zinc-100 hover:bg-zinc-800 active:scale-95 transition"
      >
        <span className="flex flex-col justify-center gap-1.5 w-4">
          <span className="block h-0.5 w-full bg-current rounded" />
          <span className="block h-0.5 w-full bg-current rounded" />
          <span className="block h-0.5 w-full bg-current rounded" />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-800 bg-zinc-950/95 py-1.5 shadow-2xl z-50 backdrop-blur-md"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => handleNav("discover", "/")}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-zinc-100 hover:bg-zinc-900"
          >
            <span>Discover</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleNav("bucket", "/bucket-list")}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-zinc-100 hover:bg-zinc-900"
          >
            <span>Bucket List</span>
            {typeof bucketCount === "number" && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-400">
                {bucketCount}
              </span>
            )}
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => handleNav("benchmarks", "/benchmarks")}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-zinc-100 hover:bg-zinc-900"
          >
            <span>Benchmarks</span>
          </button>

          <div className="my-1 border-t border-zinc-800" />

          {onAuthAction ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onAuthAction();
              }}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium text-amber-400 hover:bg-zinc-900"
            >
              <span>{isSignedIn ? "Sign Out" : "Sign In"}</span>
            </button>
          ) : (
            <Link
              href={isSignedIn ? "/auth/sign-out" : "/login"}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium text-amber-400 hover:bg-zinc-900"
            >
              <span>{isSignedIn ? "Sign Out" : "Sign In"}</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
