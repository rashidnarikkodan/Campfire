import { randomUUID } from "crypto";
import { generateName } from "../lib/nameGenerator.js";

export type PresenceState = "JOINING" | "CONNECTED" | "RECONNECTING" | "DISCONNECTED";

export interface ParticipantSession {
  sessionId: string;
  displayName: string;
  createdAt: number;
  lastActiveAt: number;
  currentRoomId: string | null;
  presenceState: PresenceState;
  activeSocketId: string | null;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const sessions = new Map<string, ParticipantSession>();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(str: unknown): str is string {
  return typeof str === "string" && UUID_REGEX.test(str.trim());
}

export function getOrCreateSession(
  sessionIdCandidate?: unknown,
  displayNameCandidate?: unknown
): ParticipantSession {
  const now = Date.now();
  let session: ParticipantSession | undefined;

  if (isValidUuid(sessionIdCandidate)) {
    const cleanId = (sessionIdCandidate as string).trim();
    session = sessions.get(cleanId);
  }

  if (!session) {
    const newSessionId = randomUUID();
    const rawName = typeof displayNameCandidate === "string" ? displayNameCandidate.trim() : "";
    const effectiveName = rawName.length > 0 ? rawName.slice(0, 32) : generateName(newSessionId);

    session = {
      sessionId: newSessionId,
      displayName: effectiveName,
      createdAt: now,
      lastActiveAt: now,
      currentRoomId: null,
      presenceState: "JOINING",
      activeSocketId: null,
    };
    sessions.set(newSessionId, session);
  } else {
    session.lastActiveAt = now;
    if (typeof displayNameCandidate === "string" && displayNameCandidate.trim().length > 0) {
      session.displayName = displayNameCandidate.trim().slice(0, 32);
    }
  }

  return session;
}

export function getSession(sessionId: string): ParticipantSession | undefined {
  return sessions.get(sessionId);
}

export function updateSessionName(sessionId: string, newDisplayName: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  const trimmed = newDisplayName.trim().slice(0, 32);
  if (!trimmed) return false;
  session.displayName = trimmed;
  session.lastActiveAt = Date.now();
  return true;
}

export function touchSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActiveAt = Date.now();
  }
}

export function pruneExpiredSessions(): number {
  const now = Date.now();
  let prunedCount = 0;
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActiveAt > SESSION_TTL_MS && session.presenceState === "DISCONNECTED") {
      sessions.delete(sessionId);
      prunedCount++;
    }
  }
  return prunedCount;
}

export function getActiveSessionCount(): number {
  return sessions.size;
}

export function resetSessionsForTesting(): void {
  sessions.clear();
}
