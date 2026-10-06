"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  Flame,
  Mic,
  Shield,
  UserX,
  Users,
  Wind,
  Sparkles,
  RefreshCw,
  Edit3,
  ArrowRight,
  Radio,
  Lock,
} from "lucide-react";
import Campfire from "@/components/Campfire";
import StarryNight from "@/components/StarryNight";
import { useUserStore } from "@/store/userStore";

const principles = [
  {
    icon: UserX,
    title: "Arrive without identity",
    text: "No accounts, passwords, handles, or social graphs. You receive a gentle temporary name from the woods.",
  },
  {
    icon: Clock,
    title: "Leave without residue",
    text: "Messages exist only in live memory. The moment a room empties, the fire turns cold and history dissolves.",
  },
  {
    icon: Users,
    title: "Intimate circles",
    text: "Rooms hold at most eight people, keeping conversations at an organic, human campfire scale.",
  },
  {
    icon: Mic,
    title: "Voice & Fleeting Text",
    text: "Speak seamlessly with push-to-talk WebRTC audio or type words that float up with the smoke.",
  },
  {
    icon: Wind,
    title: "Embrace the quiet",
    text: "The interface recedes so the crackle of wood, ambient wind, and authentic pauses have room to breathe.",
  },
  {
    icon: Shield,
    title: "Community Moderation",
    text: "No central police. Collective reports by circle members gently cool down disruptive participants.",
  },
];

export default function HomePage() {
  const displayName = useUserStore((s) => s.displayName) || "Gentle Ember";
  const setDisplayName = useUserStore((s) => s.setDisplayName);
  const randomizeName = useUserStore((s) => s.randomizeName);

  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [customRoomCode, setCustomRoomCode] = useState("");
  const [stats, setStats] = useState<{ activeRooms: number; activePeers: number }>({
    activeRooms: 0,
    activePeers: 0,
  });

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.activeRooms === "number") {
          setStats(data);
        }
      })
      .catch(() => {});
  }, []);

  const handleStartEditing = () => {
    setNameInput(displayName);
    setIsEditing(true);
  };

  const handleSaveName = () => {
    const trimmed = nameInput.trim();
    if (trimmed) {
      setDisplayName(trimmed);
    }
    setIsEditing(false);
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-forest-night text-ash select-none">
      <StarryNight />

      {/* Top Navbar */}
      <nav className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="relative grid h-8 w-8 place-items-center rounded-full bg-amber-950/40 border border-flame/30">
            <Flame size={17} className="text-flame" />
          </div>
          <span className="font-bold tracking-wider text-ash text-xs sm:text-sm uppercase">
            Campfire
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/room"
            className="warm-button inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-3.5 sm:px-4 py-2 text-xs font-semibold touch-manipulation"
          >
            <Flame size={14} />
            <span>Join Fire</span>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 flex min-h-[85svh] w-full flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12 text-center">
        {/* Glow backdrop */}
        <div className="pointer-events-none absolute top-[10vh] h-[22rem] w-[22rem] sm:h-[36rem] sm:w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(255,140,50,0.14),transparent_65%)] blur-3xl" />

        {/* Campfire Canvas in Hero */}
        <div className="relative mb-2">
          <Campfire size="hero" intensity={0.65} />
        </div>

        <div className="relative z-10 -mt-8 sm:-mt-10 flex max-w-3xl flex-col items-center gap-4 sm:gap-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-ash/[0.06] px-3.5 py-1 text-[0.7rem] sm:text-xs uppercase tracking-widest text-flame border border-flame/20 backdrop-blur-md">
            <Radio size={13} className="animate-pulse shrink-0" />
            <span className="truncate">
              {stats.activePeers > 0
                ? `${stats.activePeers} ${stats.activePeers === 1 ? "stranger" : "strangers"} by ${stats.activeRooms} campfire(s)`
                : "Live ephemeral circles"}
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-6xl lg:text-7xl leading-tight text-ash px-2">
            Sit by the fire with strangers.
          </h1>

          <p className="max-w-xl text-sm leading-relaxed text-smoke sm:text-lg px-2">
            A calm, anonymous clearing on the internet. No handles, algorithms, or history.
            Just the crackle of wood, quiet voices, and fleeting company.
          </p>

          {/* User Alias Selector Card */}
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-forest-night/60 px-4 py-2.5 backdrop-blur-xl border border-ash/[0.08] shadow-lg max-w-full">
            <span className="text-xs text-smoke">Your presence:</span>
            {isEditing ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value.slice(0, 24))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") setIsEditing(false);
                  }}
                  className="campfire-input text-xs text-ash py-0.5 px-2.5 w-28 sm:w-36"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  className="rounded-lg bg-flame/20 px-2.5 py-1 text-xs font-semibold text-flame hover:bg-flame/30 touch-manipulation min-h-[30px]"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <strong className="text-xs font-semibold text-flame">{displayName}</strong>
                <button
                  onClick={handleStartEditing}
                  title="Customize alias"
                  aria-label="Rename alias"
                  className="text-smoke/60 hover:text-ash transition p-1 touch-manipulation"
                >
                  <Edit3 size={13} />
                </button>
                <button
                  onClick={() => randomizeName()}
                  title="Roll another nature name"
                  aria-label="Randomize alias"
                  className="text-smoke/60 hover:text-flame transition p-1 touch-manipulation"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="mt-2 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-sm sm:max-w-none px-4">
            <Link
              href="/room"
              className="warm-button inline-flex items-center justify-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-bold shadow-lg shadow-flame/20 w-full sm:w-auto touch-manipulation min-h-[48px]"
            >
              <Flame size={18} />
              <span>Sit by an Open Fire</span>
            </Link>

            <Link
              href="/room?private=true"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-ash/[0.08] px-6 py-3.5 text-sm font-medium text-ash transition hover:bg-ash/[0.14] border border-ash/[0.08] w-full sm:w-auto touch-manipulation min-h-[48px]"
            >
              <Lock size={15} className="text-flame/80" />
              <span>Start Private Fire</span>
            </Link>
          </div>

          {/* Join with Room Code input */}
          <div className="mt-2 flex items-center gap-2 campfire-input p-1.5 max-w-full overflow-hidden">
            <input
              type="text"
              placeholder="Or enter room code (e.g. amber-hearth-102)"
              value={customRoomCode}
              onChange={(e) => setCustomRoomCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && customRoomCode.trim()) {
                  window.location.assign(`/room?room=${encodeURIComponent(customRoomCode.trim())}`);
                }
              }}
              className="w-48 sm:w-72 bg-transparent px-3 py-1 text-xs text-ash placeholder:text-smoke/50 focus:outline-none shrink"
            />
            <Link
              href={customRoomCode.trim() ? `/room?room=${encodeURIComponent(customRoomCode.trim())}` : "#"}
              className={`inline-flex items-center gap-1 rounded-lg bg-flame/20 px-3 py-2 text-xs font-semibold text-flame hover:bg-flame hover:text-forest-night transition touch-manipulation shrink-0 ${
                !customRoomCode.trim() ? "pointer-events-none opacity-40" : ""
              }`}
            >
              <span>Join</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </section>

      {/* Principles & Design Philosophy */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20">
        <div className="mb-10 sm:mb-14 text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-flame/80 font-bold">
            <Sparkles size={14} />
            <span>The Campfire Ethos</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-4xl text-ash">
            Built for presence, not retention.
          </h2>
          <p className="text-xs sm:text-sm leading-relaxed text-smoke">
            Most platforms are designed to trap your attention, build an archive, and monetize your
            identity. Campfire is built for human moments that leave no trace.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {principles.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="group relative rounded-3xl bg-forest-night/40 p-5 sm:p-6 backdrop-blur-xl border border-ash/[0.06] transition duration-300 hover:border-flame/30 hover:bg-forest-night/60"
              >
                <div className="mb-3.5 grid h-10 w-10 place-items-center rounded-2xl bg-amber-950/40 text-flame border border-flame/20 transition group-hover:scale-110">
                  <Icon size={20} strokeWidth={1.8} />
                </div>
                <h3 className="mb-2 text-sm sm:text-base font-semibold text-ash">{item.title}</h3>
                <p className="text-xs leading-relaxed text-smoke">{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* Atmospheric Quote & Closing */}
      <section className="relative z-10 mx-auto flex min-h-[35svh] max-w-3xl flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-20 text-center">
        <blockquote className="text-lg font-light leading-relaxed text-ash/80 sm:text-2xl italic">
          "Sometimes the most honest words are shared with people you will never see again, under a
          sky that forgets everything by dawn."
        </blockquote>

        <div className="mt-8 sm:mt-10 w-full max-w-xs sm:max-w-none">
          <Link
            href="/room"
            className="warm-button inline-flex items-center justify-center gap-2.5 rounded-full px-8 py-3.5 text-sm font-bold shadow-lg shadow-flame/20 w-full sm:w-auto touch-manipulation min-h-[48px]"
          >
            <Flame size={17} />
            <span>Step into the Clearing</span>
          </Link>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="relative z-10 border-t border-ash/[0.06] py-6 sm:py-8 text-center text-xs text-smoke/60">
        <p>Campfire • Ephemeral, private, and open source.</p>
      </footer>
    </main>
  );
}
