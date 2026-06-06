"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Flame, LogOut } from "lucide-react";
import { useFireIntensity } from "@/hooks/useFireIntensity";
import { useRoom } from "@/hooks/useRoom";
import { useSocket } from "@/hooks/useSocket";
import Campfire from "@/components/Campfire";
import ChatPanel from "@/components/ChatPanel";
import PeerList from "@/components/PeerList";
import VoiceBar from "@/components/VoiceBar";

export default function RoomPage() {
  const { socket, connected } = useSocket();
  const { roomId } = useRoom({ socket });
  const intensity = useFireIntensity();

  useEffect(() => {
    if (!socket) return;

    const onKicked = ({ reason }: { reason?: string }) => {
      window.alert(reason || "You were removed from this fire by the community.");
      window.location.assign("/");
    };

    const onCooldown = ({ remainingMs }: { remainingMs: number }) => {
      const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
      window.alert(`You can rejoin after a short cooldown. Please wait ${minutes} minute(s).`);
      window.location.assign("/");
    };

    socket.on("mod:kicked", onKicked);
    socket.on("mod:cooldown", onCooldown);
    return () => {
      socket.off("mod:kicked", onKicked);
      socket.off("mod:cooldown", onCooldown);
    };
  }, [socket]);

  if (!connected || !roomId) {
    return (
      <main className="environment flex min-h-screen flex-col items-center justify-center px-6 text-center text-ash">
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-ember/20 blur-2xl" />
          <Flame size={42} className="relative text-ember animate-pulse" />
        </div>
        <h1 className="text-xl font-medium">Finding an open fire</h1>
        <p className="mt-2 max-w-sm text-sm leading-7 text-smoke">
          You are walking through the dark until a quiet circle opens.
        </p>
      </main>
    );
  }

  return (
    <main className="environment relative grid min-h-screen grid-rows-[minmax(0,1fr)_minmax(18rem,42svh)] overflow-hidden text-ash lg:grid-cols-[minmax(0,1fr)_25rem] lg:grid-rows-1">
      <section className="relative flex min-h-0 flex-col px-5 py-5 sm:px-8">
        <header className="z-10 flex items-center justify-between gap-4">
          <div>
            <p className="text-[0.68rem] uppercase tracking-[0.28em] text-smoke">Campfire room</p>
            <p className="mt-1 text-sm font-medium text-flame">#{roomId}</p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-ash/[0.04] px-4 py-2 text-xs text-smoke transition hover:bg-ash/[0.08] hover:text-ash"
          >
            <LogOut size={14} />
            Leave
          </Link>
        </header>

        <div className="relative flex flex-1 flex-col items-center justify-center">
          <div
            className="absolute h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(255,122,26,0.16),transparent_66%)] transition-opacity duration-1000"
            style={{ opacity: 0.55 + intensity * 0.26 }}
          />
          <Campfire intensity={intensity} />
          <p className="relative -mt-12 text-center text-[0.68rem] uppercase tracking-[0.24em] text-smoke/60">
            The fire responds to presence
          </p>
        </div>

        <div className="z-10 mx-auto flex w-full max-w-3xl flex-col gap-5 pb-2">
          <PeerList socket={socket} />
          <VoiceBar socket={socket} roomId={roomId} />
        </div>
      </section>

      <aside className="min-h-0 bg-forest-night/[0.14] px-4 pb-4 pt-2 backdrop-blur-xl lg:px-5 lg:py-5">
        <ChatPanel socket={socket} roomId={roomId} />
      </aside>
    </main>
  );
}
