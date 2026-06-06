"use client";

import { AlertTriangle, Flame, User } from "lucide-react";
import type { Socket } from "socket.io-client";
import { generateName } from "@/lib/nameGenerator";
import { useRoomStore } from "@/store/roomStore";
import { useUserStore } from "@/store/userStore";
import { useVoiceStore } from "@/store/voiceStore";

type PeerListProps = {
  socket: Socket | null;
};

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const avatarBackground = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsla(${hue}, 34%, 28%, 0.72)`;
};

export default function PeerList({ socket }: PeerListProps) {
  const peers = useRoomStore((state) => state.peers);
  const localName = useUserStore((state) => state.displayName) ?? "you";
  const activeSpeakers = useVoiceStore((state) => state.activeSpeakers);
  const localSpeaking = useVoiceStore((state) => state.isSpeaking);
  const total = peers.length + 1;

  const report = (targetSocketId: string) => {
    if (!socket) return;
    if (window.confirm("Report this stranger for disrupting the campfire?")) {
      socket.emit("mod:report", { targetSocketId });
    }
  };

  const people = [
    { id: socket?.id ?? "local", name: localName, mine: true, speaking: localSpeaking },
    ...peers.map((id) => ({
      id,
      name: generateName(id),
      mine: false,
      speaking: activeSpeakers.includes(id),
    })),
  ];

  return (
    <section className="rounded-[1.8rem] px-4 py-4 bg-forest-night/10 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2 text-sm">
        <Flame size={15} className="text-ember" />
        <span>
          {total} {total === 1 ? "person" : "people"} around the fire
        </span>
      </div>

      <div className="scrollbar-none flex max-h-32 flex-wrap gap-2 overflow-y-auto">
        {people.map((person) => (
          <div
            key={person.id}
            className={`group flex min-h-10 items-center gap-2 rounded-full px-3 py-1.5 transition ${
              person.speaking ? "bg-ember/[0.18] text-ash" : "bg-ash/[0.07] text-ash/90"
            }`}
          >
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.64rem] font-semibold text-flame-soft"
              style={{ backgroundColor: avatarBackground(person.name) }}
            >
              {initials(person.name)}
            </span>
            <span className="max-w-32 truncate text-xs font-medium">
              {person.name}
              {person.mine ? <span className="ml-1 text-flame">(you)</span> : null}
            </span>
            {person.speaking ? (
              <span className="ml-1 flex h-4 items-center gap-0.5" aria-label="Speaking">
                <span className="h-2 w-1 rounded-full bg-flame" />
                <span className="h-4 w-1 rounded-full bg-flame" />
                <span className="h-3 w-1 rounded-full bg-flame" />
              </span>
            ) : (
              <User size={11} className="text-smoke/55" />
            )}
            {!person.mine ? (
              <button
                onClick={() => report(person.id)}
                title="Report"
                aria-label={`Report ${person.name}`}
                className="grid h-6 w-6 place-items-center rounded-full text-smoke/45 opacity-0 transition hover:bg-ember/10 hover:text-ember group-hover:opacity-100"
              >
                <AlertTriangle size={12} />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
