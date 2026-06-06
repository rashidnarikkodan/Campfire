import { create } from "zustand";

interface VoiceState {
  isSpeaking: boolean;
  isMuted: boolean;
  activeSpeakers: string[];
  setIsSpeaking: (v: boolean) => void;
  setIsMuted: (v: boolean) => void;
  setActiveSpeakers: (arr: string[]) => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isSpeaking: false,
  isMuted: false,
  activeSpeakers: [],
  setIsSpeaking: (v) => set({ isSpeaking: v }),
  setIsMuted: (v) => set({ isMuted: v }),
  setActiveSpeakers: (arr) => set({ activeSpeakers: arr }),
}));
