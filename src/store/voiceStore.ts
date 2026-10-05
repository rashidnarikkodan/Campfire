import { create } from "zustand";

interface VoiceState {
  isSpeaking: boolean;
  isMuted: boolean;
  activeSpeakers: string[];
  localAudioLevel: number;
  handsFreeMode: boolean;
  hasMicPermission: boolean | null;
  permissionError: string | null;
  audioAutoplayBlocked: boolean;

  availableMics: MediaDeviceInfo[];
  availableSpeakers: MediaDeviceInfo[];
  selectedMicId: string;
  selectedSpeakerId: string;
  isSettingsOpen: boolean;

  setIsSpeaking: (v: boolean) => void;
  setIsMuted: (v: boolean) => void;
  setActiveSpeakers: (arr: string[]) => void;
  setLocalAudioLevel: (lvl: number) => void;
  setHandsFreeMode: (v: boolean) => void;
  setHasMicPermission: (v: boolean | null) => void;
  setPermissionError: (err: string | null) => void;
  setAudioAutoplayBlocked: (v: boolean) => void;

  setAvailableMics: (mics: MediaDeviceInfo[]) => void;
  setAvailableSpeakers: (speakers: MediaDeviceInfo[]) => void;
  setSelectedMicId: (id: string) => void;
  setSelectedSpeakerId: (id: string) => void;
  setIsSettingsOpen: (v: boolean) => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isSpeaking: false,
  isMuted: false,
  activeSpeakers: [],
  localAudioLevel: 0,
  handsFreeMode: false,
  hasMicPermission: null,
  permissionError: null,
  audioAutoplayBlocked: false,

  availableMics: [],
  availableSpeakers: [],
  selectedMicId: "default",
  selectedSpeakerId: "default",
  isSettingsOpen: false,

  setIsSpeaking: (v) => set({ isSpeaking: v }),
  setIsMuted: (v) => set({ isMuted: v }),
  setActiveSpeakers: (arr) => set({ activeSpeakers: arr }),
  setLocalAudioLevel: (lvl) => set({ localAudioLevel: lvl }),
  setHandsFreeMode: (v) => set({ handsFreeMode: v }),
  setHasMicPermission: (v) => set({ hasMicPermission: v }),
  setPermissionError: (err) => set({ permissionError: err }),
  setAudioAutoplayBlocked: (v) => set({ audioAutoplayBlocked: v }),

  setAvailableMics: (mics) => set({ availableMics: mics }),
  setAvailableSpeakers: (speakers) => set({ availableSpeakers: speakers }),
  setSelectedMicId: (id) => set({ selectedMicId: id }),
  setSelectedSpeakerId: (id) => set({ selectedSpeakerId: id }),
  setIsSettingsOpen: (v) => set({ isSettingsOpen: v }),
}));
