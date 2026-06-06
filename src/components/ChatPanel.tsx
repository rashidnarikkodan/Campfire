"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import type { Socket } from "socket.io-client";
import { useChat } from "@/hooks/useChat";

type ChatPanelProps = {
  socket: Socket | null;
  roomId: string | null;
};

const MAX_MESSAGE_LENGTH = 500;

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

export default function ChatPanel({ socket, roomId }: ChatPanelProps) {
  const { messages, sendMessage } = useChat({ socket, roomId });
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const remaining = useMemo(() => MAX_MESSAGE_LENGTH - text.length, [text]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setText("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col rounded-[2rem] bg-forest-night/10 backdrop-blur-xl">
      <header className="flex items-center gap-3 px-5 py-4">
        <MessageCircle size={17} className="text-flame" />
        <div>
          <h2 className="text-sm font-medium uppercase tracking-[0.18em]">Fleeting chat</h2>
          <p className="mt-1 text-xs text-smoke">Nothing here is saved.</p>
        </div>
      </header>

      <div className="scrollbar-none flex-1 space-y-5 overflow-y-auto px-5 py-2">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm leading-7 text-smoke">
            <p>The air is quiet around the fire.</p>
            <p>Type below to send a word into the dark.</p>
          </div>
        ) : (
          messages.map((message) => {
            const isMine = message.senderId === socket?.id;
            return (
              <article
                key={message.id}
                className={`flex max-w-[88%] flex-col gap-1.5 ${isMine ? "ml-auto items-end" : "mr-auto items-start"}`}
              >
                <p className="text-[0.68rem] uppercase tracking-[0.14em] text-smoke/70">
                  <span className={isMine ? "text-flame/90" : ""}>{isMine ? "you" : "stranger"}</span>
                  <span className="mx-2">/</span>
                  {formatTime(message.timestamp)}
                </p>
                <p
                  className={`rounded-[1.4rem] px-4 py-2.5 text-sm leading-7 ${
                    isMine ? "bg-ember/[0.18] text-ash" : "bg-ash/[0.07] text-ash/90"
                  }`}
                >
                  {message.text}
                </p>
              </article>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="px-4 pb-4 pt-3">
        <div className="flex items-end gap-2 rounded-[1.4rem] bg-forest-night/18 px-3 py-3">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder={roomId ? "Say something..." : "Connecting..."}
            disabled={!roomId}
            rows={1}
            className="scrollbar-none max-h-28 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-6 text-ash placeholder:text-smoke/65 focus:outline-none disabled:cursor-not-allowed"
          />
          <div className="flex flex-col items-end gap-2">
            <span className={`text-[0.65rem] ${remaining < 40 ? "text-ember" : "text-smoke/60"}`}>
              {remaining}
            </span>
            <button
              onClick={handleSend}
              disabled={!roomId || !text.trim()}
              aria-label="Send message"
              className="warm-button grid h-10 w-10 place-items-center rounded-full disabled:pointer-events-none disabled:opacity-35"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
