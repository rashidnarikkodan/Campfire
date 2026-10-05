import { create } from "zustand";
import { MAX_VISIBLE_MESSAGES } from "@/lib/constants";
import type { PeerInfo } from "@/server/roomManager";

export interface Message {
  id: string;
  senderId: string;
  senderName?: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface TypingUser {
  socketId: string;
  displayName: string;
}

interface RoomState {
  roomId: string | null;
  peers: PeerInfo[];
  messages: Message[];
  typingUsers: TypingUser[];
  stokeCount: number;
  lastStokedBy: { displayName: string; timestamp: number } | null;

  addMessage: (msg: Message) => void;
  setPeers: (peers: PeerInfo[]) => void;
  addPeer: (peer: PeerInfo) => void;
  updatePeer: (socketId: string, updates: Partial<PeerInfo>) => void;
  removePeer: (socketId: string) => void;
  setRoomId: (id: string | null) => void;
  setTypingUser: (socketId: string, displayName: string, isTyping: boolean) => void;
  incrementStoke: (displayName: string) => void;
  setStokeCount: (count: number) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  roomId: null,
  peers: [],
  messages: [],
  typingUsers: [],
  stokeCount: 0,
  lastStokedBy: null,

  addMessage: (msg) =>
    set((s) => ({
      messages: s.messages.some((message) => message.id === msg.id)
        ? s.messages
        : [...s.messages, msg].slice(-MAX_VISIBLE_MESSAGES),
    })),

  setPeers: (peers) => set({ peers }),

  addPeer: (peer) =>
    set((s) => ({
      peers: s.peers.some((p) => p.socketId === peer.socketId)
        ? s.peers.map((p) => (p.socketId === peer.socketId ? peer : p))
        : [...s.peers, peer],
    })),

  updatePeer: (socketId, updates) =>
    set((s) => ({
      peers: s.peers.map((p) =>
        p.socketId === socketId ? { ...p, ...updates } : p
      ),
    })),

  removePeer: (socketId) =>
    set((s) => ({
      peers: s.peers.filter((p) => p.socketId !== socketId),
      typingUsers: s.typingUsers.filter((t) => t.socketId !== socketId),
    })),

  setRoomId: (id) => set({ roomId: id }),

  setTypingUser: (socketId, displayName, isTyping) =>
    set((s) => {
      const filtered = s.typingUsers.filter((u) => u.socketId !== socketId);
      if (isTyping) {
        return { typingUsers: [...filtered, { socketId, displayName }] };
      }
      return { typingUsers: filtered };
    }),

  incrementStoke: (displayName) =>
    set((s) => ({
      stokeCount: s.stokeCount + 1,
      lastStokedBy: { displayName, timestamp: Date.now() },
    })),

  setStokeCount: (count) => set({ stokeCount: count }),

  reset: () =>
    set({
      roomId: null,
      peers: [],
      messages: [],
      typingUsers: [],
      stokeCount: 0,
      lastStokedBy: null,
    }),
}));
