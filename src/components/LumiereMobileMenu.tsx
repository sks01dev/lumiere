"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface LumiereMobileMenuProps {
  bucketCount?: number;
  userLabel?: string;
  onSelectTab?: (tab: string) => void;
  onAuthClick?: () => void;
}

export default function LumiereMobileMenu({
  bucketCount,
  userLabel = "SHIVAM",
  onSelectTab,
  onAuthClick,
}: LumiereMobileMenuProps) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const go = (tab: string, fallbackHref: string) => {
    setOpen(false);
    if (onSelectTab) {
      onSelectTab(tab);
    } else if (typeof window !== "undefined") {
      window.location.assign(fallbackHref);
    }
  };

  return (
    <div ref={boxRef} className="relative md:hidden shrink-0">
      <button
        type="button"
        aria-label="Toggle menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
      >
        <span className="flex w-4 flex-col gap-1">
          <span className="block h-0.5 w-full bg-current rounded" />
          <span className="block h-0.5 w-full bg-current rounded" />
          <span className="block h-0.5 w-full bg-current rounded" />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-52 rounded-xl border border-zinc-800 bg-zinc-950 py-1.5 shadow-2xl z-50"
        >
          <button
            type="button"
            onClick={() => go("discover", "/")}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-zinc-100 hover:bg-zinc-900"
          >
            <span>Discover</span>
          </button>
          <button
            type="button"
            onClick={() => go("bucket", "/bucket-list")}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-zinc-100 hover:bg-zinc-900"
          >
            <span>Bucket List</span>
            {typeof bucketCount === "number" && (
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
                {bucketCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => go("benchmarks", "/benchmarks")}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-zinc-100 hover:bg-zinc-900"
          >
            <span>Benchmarks</span>
          </button>
          <Link
            href="/about"
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm text-zinc-100 hover:bg-zinc-900"
          >
            <span>About</span>
          </Link>
          <div className="my-1 border-t border-zinc-800" />
          {onAuthClick ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAuthClick();
              }}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium text-emerald-400 hover:bg-zinc-900"
            >
              <span>{userLabel}</span>
            </button>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium text-emerald-400 hover:bg-zinc-900"
            >
              <span>{userLabel}</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
