"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface WatchlistContextValue {
  user: User | null;
  isGuest: boolean;
  ready: boolean;
  savedIds: number[];
  enterAsGuest: () => void;
  resetEntry: () => void;
  toggleMovie: (movieId: number) => Promise<void>;
  isSaved: (movieId: number) => boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextValue>({
  user: null,
  isGuest: false,
  ready: false,
  savedIds: [],
  enterAsGuest: () => {},
  resetEntry: () => {},
  toggleMovie: async () => {},
  isSaved: () => false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

const GUEST_STORAGE_KEY = "lumiere_guest_watchlist";
const GUEST_ENTERED_KEY = "lumiere_guest_entered";

function readGuestIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GUEST_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [ready, setReady] = useState(false);
  const [savedIds, setSavedIds] = useState<number[]>([]);

  const syncCloudWatchlist = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from("watchlist")
      .select("movie_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const cloudIds = (data || []).map((r) => r.movie_id);
    const localIds = readGuestIds();

    const missingInCloud = localIds.filter((id) => !cloudIds.includes(id));
    if (missingInCloud.length > 0) {
      await supabase
        .from("watchlist")
        .insert(
          missingInCloud.map((movie_id) => ({ user_id: userId, movie_id })),
        );
      setSavedIds([...missingInCloud, ...cloudIds]);
    } else {
      setSavedIds(cloudIds);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const guestIds = readGuestIds();
      const entered =
        typeof window !== "undefined" &&
        window.sessionStorage.getItem(GUEST_ENTERED_KEY) === "1";

      if (!supabase) {
        if (mounted) {
          setSavedIds(guestIds);
          setIsGuest(entered);
          setReady(true);
        }
        return;
      }

      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;
      if (!mounted) return;

      setUser(currentUser);
      if (currentUser) {
        await syncCloudWatchlist(currentUser.id);
      } else {
        setSavedIds(guestIds);
        setIsGuest(entered);
      }
      if (mounted) setReady(true);
    }

    void init();

    if (!supabase) return;

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextUser = session?.user ?? null;
        setUser(nextUser);
        if (nextUser) {
          void syncCloudWatchlist(nextUser.id);
        } else {
          setSavedIds(readGuestIds());
        }
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [syncCloudWatchlist]);

  function enterAsGuest() {
    setIsGuest(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(GUEST_ENTERED_KEY, "1");
    }
  }

  function resetEntry() {
    setIsGuest(false);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(GUEST_ENTERED_KEY);
    }
  }

  async function toggleMovie(movieId: number) {
    const exists = savedIds.includes(movieId);
    const next = exists
      ? savedIds.filter((id) => id !== movieId)
      : [movieId, ...savedIds];
    setSavedIds(next);

    if (user && supabase) {
      if (exists) {
        await supabase
          .from("watchlist")
          .delete()
          .eq("user_id", user.id)
          .eq("movie_id", movieId);
      } else {
        await supabase
          .from("watchlist")
          .insert({ user_id: user.id, movie_id: movieId });
      }
    } else if (typeof window !== "undefined") {
      window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(next));
    }
  }

  async function signInWithGoogle() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    resetEntry();
  }

  return (
    <WatchlistContext.Provider
      value={{
        user,
        isGuest,
        ready,
        savedIds,
        enterAsGuest,
        resetEntry,
        toggleMovie,
        isSaved: (id) => savedIds.includes(id),
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
}

export const useWatchlist = () => useContext(WatchlistContext);
