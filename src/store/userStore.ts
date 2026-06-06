import { create } from "zustand";
import { generateSessionId, generateName } from "@/lib/nameGenerator";

const SESSION_KEY = "internet-campfire-session";
const NAME_KEY = "internet-campfire-name";

interface UserState {
  sessionId: string | null;
  displayName: string | null;
  init: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  sessionId: null,
  displayName: null,
  init: () => {
    if (get().sessionId) return; // already initialized
    const storedSession = window.localStorage.getItem(SESSION_KEY);
    const storedName = window.localStorage.getItem(NAME_KEY);
    const sessionId = storedSession || generateSessionId();
    const displayName = storedName || generateName(sessionId);

    window.localStorage.setItem(SESSION_KEY, sessionId);
    window.localStorage.setItem(NAME_KEY, displayName);

    set({
      sessionId,
      displayName,
    });
  },
}));
