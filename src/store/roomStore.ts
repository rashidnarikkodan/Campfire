import { create } from "zustand";
import { MAX_VISIBLE_MESSAGES } from "@/lib/constants";

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

interface RoomState {
  roomId: string | null;
  peers: string[];
  messages: Message[];
  addMessage: (msg: Message) => void;
  setPeers: (peers: string[]) => void;
  addPeer: (socketId: string) => void;
  removePeer: (socketId: string) => void;
  setRoomId: (id: string | null) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  roomId: null,
  peers: [],
  messages: [],
  addMessage: (msg) =>
    set((s) => ({
      messages: s.messages.some((message) => message.id === msg.id)
        ? s.messages
        : [...s.messages, msg].slice(-MAX_VISIBLE_MESSAGES),
    })),
  setPeers: (peers) => set({ peers: [...new Set(peers)] }),
  addPeer: (socketId) =>
    set((s) => ({
      peers: s.peers.includes(socketId) ? s.peers : [...s.peers, socketId],
    })),
  removePeer: (socketId) =>
    set((s) => ({
      peers: s.peers.filter((id) => id !== socketId),
    })),
  setRoomId: (id) => set({ roomId: id }),
  reset: () => set({ roomId: null, peers: [], messages: [] }),
}));
