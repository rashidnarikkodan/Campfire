import { create } from "zustand";
import { generateSessionId, generateName } from "@/lib/nameGenerator";

const SESSION_KEY = "internet-campfire-session";
const NAME_KEY = "internet-campfire-name";

interface UserState {
  sessionId: string | null;
  displayName: string | null;
  init: () => void;
  setDisplayName: (name: string) => void;
  randomizeName: () => string;
}

export const useUserStore = create<UserState>((set, get) => ({
  sessionId: null,
  displayName: null,

  init: () => {
    if (get().sessionId) return;
    if (typeof window === "undefined") return;

    let sessionId = window.localStorage.getItem(SESSION_KEY);
    let displayName = window.localStorage.getItem(NAME_KEY);

    if (!sessionId) {
      sessionId = generateSessionId();
      window.localStorage.setItem(SESSION_KEY, sessionId);
    }

    if (!displayName) {
      displayName = generateName(sessionId);
      window.localStorage.setItem(NAME_KEY, displayName);
    }

    set({ sessionId, displayName });
  },

  setDisplayName: (name: string) => {
    const trimmed = name.trim().slice(0, 32);
    if (!trimmed) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(NAME_KEY, trimmed);
    }
    set({ displayName: trimmed });
  },

  randomizeName: () => {
    const newName = generateName();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(NAME_KEY, newName);
    }
    set({ displayName: newName });
    return newName;
  },
}));
