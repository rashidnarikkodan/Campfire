"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Clock, Flame, MessageCircle, Mic, Shield, UserX, Users, Wind } from "lucide-react";
import Campfire from "@/components/Campfire";

const principles = [
  { icon: UserX, title: "Arrive without identity", text: "No accounts, profiles, handles, follows, or history." },
  { icon: Clock, title: "Leave without residue", text: "Messages live in memory and disappear with the room." },
  { icon: Users, title: "Stay small", text: "Rooms fill at eight people so the conversation keeps a human scale." },
  { icon: Mic, title: "Speak or type", text: "Use text or push-to-talk voice when the moment calls for it." },
  { icon: Wind, title: "Let quiet remain", text: "The interface recedes so the fire, voices, and pauses have room." },
];

export default function HomePage() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll(".scroll-fade"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.12 }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="environment min-h-screen overflow-hidden text-ash">
      <section className="relative flex min-h-[92svh] w-full flex-col items-center justify-center px-6 py-20 text-center">
        <div className="absolute inset-x-0 bottom-[-8rem] h-80 bg-[radial-gradient(ellipse_at_center,rgba(255,122,26,0.18),transparent_68%)]" />
        <div className="pointer-events-none absolute top-[8vh] h-[42rem] w-[42rem] rounded-full bg-[radial-gradient(circle,rgba(255,179,71,0.12),transparent_62%)] blur-2xl" />
        <Campfire size="hero" intensity={0.58} />
        <div className="relative z-10 -mt-12 flex max-w-3xl flex-col items-center gap-6">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-flame/80">
            <Flame size={14} />
            ephemeral rooms
          </p>
          <h1 className="text-5xl font-semibold leading-none tracking-normal sm:text-6xl lg:text-8xl">
            Internet Campfire
          </h1>
          <p className="max-w-xl text-base leading-8 text-smoke sm:text-lg">
            A quiet place where strangers sit together for a while. No names, no feeds, no archive.
            Just presence around a shared fire.
          </p>
          <Link
            href="/room"
            className="warm-button mt-2 inline-flex items-center gap-3 rounded-full px-7 py-3 text-sm font-semibold"
          >
            <Flame size={17} />
            Join the fire
          </Link>
        </div>
      </section>

      <section className="scroll-fade mx-auto grid w-full max-w-6xl gap-12 px-6 py-20 md:grid-cols-[0.8fr_1.2fr] md:items-center">
        <div className="space-y-5">
          <Shield className="text-flame/70" size={24} />
          <h2 className="text-3xl font-medium tracking-normal sm:text-4xl">Designed to disappear.</h2>
          <p className="text-base leading-8 text-smoke">
            Internet Campfire is intentionally sparse. It keeps only the live room state needed to
            connect people, then lets that state go when the room empties.
          </p>
        </div>
        <div className="grid gap-7 sm:grid-cols-2">
          {principles.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="space-y-3">
                <Icon className="text-flame/75" size={21} strokeWidth={1.8} />
                <h3 className="text-lg font-medium">{item.title}</h3>
                <p className="text-sm leading-7 text-smoke">{item.text}</p>
              </article>
            );
          })}
          <article className="space-y-3 sm:col-span-2">
            <MessageCircle className="text-flame/75" size={21} strokeWidth={1.8} />
            <h3 className="text-lg font-medium">Moderated by the circle</h3>
            <p className="max-w-2xl text-sm leading-7 text-smoke">
              Repeated reports remove disruptive users for a short cooldown, without introducing
              permanent accounts or stored reputation.
            </p>
          </article>
        </div>
      </section>

      <section className="scroll-fade mx-auto flex min-h-[54svh] w-full max-w-3xl flex-col items-center justify-center px-6 py-20 text-center">
        <blockquote className="text-2xl font-light leading-10 text-ash/80 sm:text-3xl sm:leading-[3.25rem]">
          "You do not need a profile to be present. Sometimes the most honest conversations happen
          between people who will never meet again."
        </blockquote>
        <Link
          href="/room"
          className="mt-12 inline-flex items-center gap-3 rounded-full bg-ash/10 px-6 py-3 text-sm text-ash transition hover:bg-ash/15"
        >
          Find a fire
          <Flame size={16} className="text-ember" />
        </Link>
      </section>
    </main>
  );
}
