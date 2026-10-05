"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, Sparkles, Flame, Coffee, Trees } from "lucide-react";
import type { Socket } from "socket.io-client";
import { useChat } from "@/hooks/useChat";

type ChatPanelProps = {
  socket: Socket | null;
  roomId: string | null;
  onStoke?: () => void;
};

const MAX_MESSAGE_LENGTH = 500;

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

const QUICK_REACTIONS = [
  { icon: Flame, text: "🔥 Tosses dry cedar on the fire", label: "Wood" },
  { icon: Coffee, text: "☕ Pours warm herbal tea", label: "Tea" },
  { icon: Sparkles, text: "✨ Gazes quietly at the stars", label: "Stars" },
  { icon: Trees, text: "🌲 Listens to the night wind in the pine", label: "Wind" },
];

export default function ChatPanel({ socket, roomId, onStoke }: ChatPanelProps) {
  const { messages, typingUsers, chatError, sendMessage, sendTyping } = useChat({ socket, roomId });
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const remaining = useMemo(() => MAX_MESSAGE_LENGTH - text.length, [text]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typingUsers]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setText("");
    sendTyping(false);
  };

  const handleQuickReaction = (reactionText: string) => {
    sendMessage(reactionText);
    if (reactionText.includes("🔥") && onStoke) {
      onStoke();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value.slice(0, MAX_MESSAGE_LENGTH);
    setText(val);
    if (val.length > 0) {
      sendTyping(true);
    } else {
      sendTyping(false);
    }
  };

  const otherTypingUsers = typingUsers.filter((u) => u.socketId !== socket?.id);

  return (
    <div className="flex h-full min-h-[340px] w-full flex-col rounded-2xl bg-forest-night/60 backdrop-blur-xl border border-ash/[0.08] shadow-lg overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-ash/[0.08] px-3.5 py-2.5 shrink-0 bg-forest-night/40">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-flame" />
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-ash">Fleeting Chat</h2>
            <p className="text-[0.65rem] text-smoke">Spoken words dissolve with the fire</p>
          </div>
        </div>
      </header>

      {/* Chat Error Banner */}
      {chatError && (
        <div className="px-3 py-1.5 bg-amber-950/60 border-b border-amber-500/30 text-[0.7rem] font-medium text-amber-200 animate-fade-up">
          {chatError}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="scrollbar-none flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center text-xs leading-6 text-smoke/70">
            <Sparkles size={24} className="mb-2 text-ember/50 animate-pulse" />
            <p className="font-medium text-ash/80">The hearth is quiet.</p>
            <p>Type a note or share a quick campfire reaction below.</p>
          </div>
        ) : (
          messages.map((message) => {
            if (message.isSystem) {
              return (
                <div key={message.id} className="flex items-center justify-center my-1.5">
                  <span className="rounded-full bg-ash/[0.05] px-3 py-0.5 text-[0.68rem] text-smoke border border-ash/[0.04]">
                    {message.text}
                  </span>
                </div>
              );
            }

            const isMine = message.senderId === socket?.id;
            const senderName = message.senderName || (isMine ? "you" : "stranger");

            return (
              <article
                key={message.id}
                className={`flex max-w-[88%] sm:max-w-[82%] flex-col gap-1 ${
                  isMine ? "ml-auto items-end" : "mr-auto items-start"
                }`}
              >
                <div className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-wider text-smoke/70">
                  <span className={isMine ? "font-semibold text-flame" : "font-medium text-ash/80"}>
                    {senderName}
                  </span>
                  <span>•</span>
                  <span>{formatTime(message.timestamp)}</span>
                </div>

                <div
                  className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed break-words ${
                    isMine
                      ? "bg-gradient-to-tr from-amber-950/70 to-amber-900/50 text-ash border border-flame/30 shadow-sm"
                      : "bg-ash/[0.08] text-ash/90 border border-ash/[0.08]"
                  }`}
                >
                  {message.text}
                </div>
              </article>
            );
          })
        )}

        {/* Typing indicator */}
        {otherTypingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-[0.7rem] text-flame/80 italic py-1">
            <span className="flex gap-1 items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-flame animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-flame animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-flame animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
            <span>
              {otherTypingUsers.map((u) => u.displayName).join(", ")}{" "}
              {otherTypingUsers.length === 1 ? "is typing..." : "are typing..."}
            </span>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Quick Campfire Reactions Chips */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto scrollbar-none border-t border-ash/[0.06] bg-forest-night/40 shrink-0">
        {QUICK_REACTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => handleQuickReaction(item.text)}
              disabled={!roomId}
              title={item.text}
              className="inline-flex items-center gap-1 shrink-0 rounded-full bg-ash/[0.06] px-3 py-1.5 text-[0.7rem] font-medium text-smoke hover:text-ash hover:bg-ash/[0.12] transition active:scale-95 touch-manipulation disabled:opacity-40"
            >
              <Icon size={13} className="text-flame" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="p-2.5 shrink-0 bg-forest-night/60 border-t border-ash/[0.06]">
        <div className="flex items-end gap-2 rounded-xl bg-forest-night/80 px-3 py-1.5 border border-ash/[0.1] focus-within:border-flame/50 transition">
          <textarea
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={roomId ? "Share a thought..." : "Connecting..."}
            disabled={!roomId}
            rows={1}
            className="scrollbar-none max-h-24 min-h-8 flex-1 resize-none bg-transparent py-1 text-xs leading-5 text-ash placeholder:text-smoke/50 focus:outline-none disabled:cursor-not-allowed"
          />

          <div className="flex items-center gap-2 shrink-0 pb-0.5">
            <span
              className={`text-[0.62rem] font-mono ${
                remaining < 30 ? "text-ember font-bold" : "text-smoke/50"
              }`}
            >
              {remaining}
            </span>

            <button
              onClick={handleSend}
              disabled={!roomId || !text.trim()}
              aria-label="Send message"
              className="grid h-9 w-9 place-items-center rounded-full bg-flame/20 text-flame hover:bg-flame hover:text-forest-night transition active:scale-95 disabled:pointer-events-none disabled:opacity-30 touch-manipulation"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
