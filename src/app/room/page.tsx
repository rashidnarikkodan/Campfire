"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Flame, MessageSquare, X, Volume2 } from "lucide-react";
import { useFireIntensity } from "@/hooks/useFireIntensity";
import { useRoom } from "@/hooks/useRoom";
import { useSocket } from "@/hooks/useSocket";
import { useVoice } from "@/hooks/useVoice";
import { useRoomStore, type Message } from "@/store/roomStore";
import Campfire from "@/components/Campfire";
import ChatPanel from "@/components/ChatPanel";
import PeerList from "@/components/PeerList";
import VoiceBar from "@/components/VoiceBar";
import RoomHeader from "@/components/RoomHeader";
import StarryNight from "@/components/StarryNight";

function RoomContent() {
  const searchParams = useSearchParams();
  const targetRoomId = searchParams.get("room");
  const isPrivate = searchParams.get("private") === "true";

  const { socket, connected } = useSocket();
  const { roomId, stokeFire, updateDisplayName } = useRoom({
    socket,
    targetRoomId,
    isPrivate,
  });
  const { audioAutoplayBlocked, ensureAudioContextActive } = useVoice({
    socket,
    roomId,
  });
  const intensity = useFireIntensity();
  const [activeTab, setActiveTab] = useState<"campfire" | "chat">("campfire");
  const [unreadChatCount, setUnreadChatCount] = useState<number>(0);
  const [floatingMessage, setFloatingMessage] = useState<Message | null>(null);

  const messages = useRoomStore((s) => s.messages);
  const lastMessageCountRef = useRef(messages.length);
  const floatingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track unread messages & trigger floating text on 'The Fire' screen
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && !lastMsg.isSystem && lastMsg.senderId !== socket?.id) {
        if (activeTab === "campfire") {
          setUnreadChatCount((prev) => prev + 1);
        }

        // Show small text popup on The Fire screen
        setFloatingMessage(lastMsg);
        if (floatingTimeoutRef.current) {
          clearTimeout(floatingTimeoutRef.current);
        }
        floatingTimeoutRef.current = setTimeout(() => {
          setFloatingMessage(null);
        }, 5500);
      }
    }
    lastMessageCountRef.current = messages.length;
  }, [messages, activeTab, socket?.id]);

  const handleTabChange = (tab: "campfire" | "chat") => {
    setActiveTab(tab);
    if (tab === "chat") {
      setUnreadChatCount(0);
      setFloatingMessage(null);
    }
  };

  // Unlock audio context on first interaction
  useEffect(() => {
    const handleFirstTouch = () => {
      ensureAudioContextActive();
      window.removeEventListener("click", handleFirstTouch);
      window.removeEventListener("keydown", handleFirstTouch);
      window.removeEventListener("touchstart", handleFirstTouch);
      window.removeEventListener("pointerdown", handleFirstTouch);
    };
    window.addEventListener("click", handleFirstTouch, { once: true });
    window.addEventListener("keydown", handleFirstTouch, { once: true });
    window.addEventListener("touchstart", handleFirstTouch, { once: true });
    window.addEventListener("pointerdown", handleFirstTouch, { once: true });

    return () => {
      window.removeEventListener("click", handleFirstTouch);
      window.removeEventListener("keydown", handleFirstTouch);
      window.removeEventListener("touchstart", handleFirstTouch);
      window.removeEventListener("pointerdown", handleFirstTouch);
    };
  }, [ensureAudioContextActive]);

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
      <main className="relative flex h-[100dvh] w-full flex-col items-center justify-center px-6 text-center text-ash bg-forest-night overflow-hidden">
        <StarryNight />
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-full bg-ember/30 blur-2xl animate-pulse" />
            <Flame size={48} className="relative text-flame animate-bounce" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ash">
            Finding a warm circle
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-smoke">
            Stepping through the dark until a quiet fire opens...
          </p>
          <div className="mt-8 flex items-center gap-2 text-xs text-smoke/70">
            <span className="h-1.5 w-1.5 rounded-full bg-flame animate-ping" />
            <span>Connecting to mesh network</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      onClick={ensureAudioContextActive}
      className="relative flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-forest-night text-ash"
    >
      <StarryNight />

      {/* Sticky Top Header (flush to top with non-rounded top-left & top-right corners) */}
      <RoomHeader roomId={roomId} socket={socket} onStoke={stokeFire} />

      {/* Browser Autoplay Blocked Banner */}
      {audioAutoplayBlocked && (
        <div
          onClick={ensureAudioContextActive}
          className="relative z-30 mx-2 mt-2 flex items-center justify-between gap-3 rounded-2xl bg-flame px-4 py-2 text-xs font-bold text-forest-night shadow-xl shadow-flame/30 cursor-pointer animate-bounce border border-white/20"
        >
          <div className="flex items-center gap-2">
            <Volume2 size={16} />
            <span>Click anywhere to enable audio from strangers!</span>
          </div>
          <span className="rounded-full bg-forest-night/20 px-2.5 py-0.5 text-[0.68rem] font-extrabold uppercase">
            Tap to Unmute
          </span>
        </div>
      )}

      {/* Main Responsive Grid Container */}
      <div className="relative z-10 grid flex-1 min-h-0 gap-3 p-2 sm:p-3 md:grid-cols-[1fr_22rem] lg:grid-cols-[1fr_26rem] overflow-hidden">
        {/* Left Section: Campfire Visualizer, Peer Circle & Voice station */}
        <section
          className={`relative flex min-h-0 flex-col justify-between overflow-y-auto scrollbar-none ${
            activeTab === "chat" ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Campfire Visualizer Stage */}
          <div className="relative flex flex-1 flex-col items-center justify-center min-h-[220px] sm:min-h-[300px]">
            {/* Ambient Radial Glow */}
            <div
              className="pointer-events-none absolute h-[18rem] w-[18rem] sm:h-[34rem] sm:w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(255,122,26,0.18),transparent_65%)] transition-opacity duration-1000"
              style={{ opacity: 0.5 + intensity * 0.35 }}
            />

            <Campfire intensity={intensity} size="room" onStoke={stokeFire} />

            <div className="relative -mt-4 sm:-mt-8 flex flex-col items-center gap-1 text-center">
              <p className="text-[0.65rem] sm:text-[0.68rem] uppercase tracking-[0.22em] text-smoke/70">
                Tap fire to throw embers & feed sparks
              </p>
            </div>
          </div>

          {/* Floating Live Chat Message Snippet (Visible on 'The Fire' screen) */}
          {floatingMessage && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 w-[92%] sm:w-[85%] max-w-md animate-fade-up">
              <div
                onClick={() => handleTabChange("chat")}
                className="group flex items-center justify-between gap-2.5 rounded-full bg-forest-night/90 px-3.5 py-2 backdrop-blur-xl border border-flame/40 shadow-xl shadow-flame/15 cursor-pointer active:scale-95 transition"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-flame/20 text-flame">
                    <MessageSquare size={12} />
                  </div>
                  <span className="text-[0.72rem] font-bold text-flame shrink-0">
                    {floatingMessage.senderName || "Stranger"}:
                  </span>
                  <span className="truncate text-xs text-ash/90">
                    {floatingMessage.text}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFloatingMessage(null);
                  }}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-smoke/60 hover:text-ash hover:bg-ash/10 transition"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          )}

          {/* Bottom Dock: Peer Circle & Voice Station */}
          <div className="w-full shrink-0 space-y-2 pt-1 pb-1">
            <PeerList socket={socket} onUpdateName={updateDisplayName} />
            <VoiceBar socket={socket} roomId={roomId} />
          </div>
        </section>

        {/* Right Section: Chat Drawer */}
        <aside
          className={`min-h-0 ${
            activeTab === "campfire" ? "hidden md:flex" : "flex"
          } flex-col h-full overflow-hidden`}
        >
          <ChatPanel socket={socket} roomId={roomId} onStoke={stokeFire} />
        </aside>
      </div>

      {/* Sleek Small Floating Toggle Button for Mobile Navigation */}
      <div className="fixed bottom-20 right-4 z-40 md:hidden">
        {activeTab === "campfire" ? (
          <button
            onClick={() => handleTabChange("chat")}
            title="Open Chat"
            className="relative flex h-12 w-12 items-center justify-center rounded-full bg-flame text-forest-night shadow-xl shadow-flame/30 hover:scale-105 active:scale-95 transition border border-white/20 touch-manipulation"
          >
            <MessageSquare size={20} />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-500 px-1 text-[0.65rem] font-extrabold text-forest-night animate-bounce shadow-md">
                {unreadChatCount}
              </span>
            )}
          </button>
        ) : (
          <button
            onClick={() => handleTabChange("campfire")}
            title="Return to Campfire"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-forest-night/90 text-flame shadow-xl shadow-flame/20 hover:scale-105 active:scale-95 transition border border-flame/40 backdrop-blur-md touch-manipulation"
          >
            <Flame size={22} className="animate-pulse" />
          </button>
        )}
      </div>
    </main>
  );
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <main className="flex h-[100dvh] items-center justify-center bg-forest-night text-ash">
          <div className="flex items-center gap-2">
            <Flame size={24} className="text-flame animate-pulse" />
            <span className="text-sm font-medium">Entering the woods...</span>
          </div>
        </main>
      }
    >
      <RoomContent />
    </Suspense>
  );
}
