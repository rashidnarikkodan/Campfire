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
    <main className="environment relative grid min-h-screen grid-rows-[auto_1fr_auto] gap-2 sm:gap-4 md:grid-cols-[1fr_25rem] md:grid-rows-1 overflow-hidden text-ash p-2 sm:p-4">
      <section className="relative flex min-h-0 flex-col justify-between md:col-span-1 md:row-span-1">
        <header className="z-10 flex items-center justify-between gap-2 sm:gap-4">
          <div className="min-w-0">
            <p className="text-[0.65rem] sm:text-[0.68rem] uppercase tracking-[0.2em] sm:tracking-[0.28em] text-smoke truncate">Campfire room</p>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm font-medium text-flame">#{roomId}</p>
          </div>
          <Link
            href="/"
            className="shrink-0 inline-flex items-center gap-1 sm:gap-2 rounded-full bg-ash/[0.04] px-2 sm:px-4 py-1.5 sm:py-2 text-[0.7rem] sm:text-xs text-smoke transition hover:bg-ash/[0.08] hover:text-ash"
          >
            <LogOut size={12} className="sm:w-[14px] sm:h-[14px]" />
            <span className="hidden xs:inline">Leave</span>
          </Link>
        </header>

        <div className="relative flex flex-1 flex-col items-center justify-center min-h-[200px]">
          <div
            className="absolute h-[20rem] w-[20rem] sm:h-[34rem] sm:w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(255,122,26,0.16),transparent_66%)] transition-opacity duration-1000"
            style={{ opacity: 0.55 + intensity * 0.26 }}
          />
          <Campfire intensity={intensity} />
          <p className="relative -mt-8 sm:-mt-12 px-2 text-center text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.2em] sm:tracking-[0.24em] text-smoke/60">
            The fire responds to presence
          </p>
        </div>

        <div className="z-10 w-full flex flex-col gap-3 sm:gap-5">
          <PeerList socket={socket} />
          <VoiceBar socket={socket} roomId={roomId} />
        </div>
      </section>

      <aside className="min-h-0 bg-forest-night/[0.14] px-2 sm:px-4 md:px-5 py-2 sm:py-4 md:py-5 backdrop-blur-xl rounded-lg sm:rounded-xl md:rounded-none md:max-h-screen md:overflow-hidden">
        <ChatPanel socket={socket} roomId={roomId} />
      </aside>
    </main>
  );
}
