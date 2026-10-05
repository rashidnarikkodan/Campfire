/**
 * In-memory sliding window rate limiter for WebSocket events per socket ID.
 */
interface RateLimitConfig {
  maxEvents: number;
  windowMs: number;
}

const eventRecords = new Map<string, number[]>();

export function checkRateLimit(socketId: string, eventName: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const key = `${socketId}:${eventName}`;
  const timestamps = eventRecords.get(key) || [];

  // Filter out timestamps outside the window
  const validTimestamps = timestamps.filter((t) => now - t < config.windowMs);

  if (validTimestamps.length >= config.maxEvents) {
    return false; // Rate limit exceeded
  }

  validTimestamps.push(now);
  eventRecords.set(key, validTimestamps);
  return true; // Allowed
}

export function cleanupRateLimits(socketId: string): void {
  for (const key of eventRecords.keys()) {
    if (key.startsWith(`${socketId}:`)) {
      eventRecords.delete(key);
    }
  }
}

export function resetRateLimitsForTesting(): void {
  eventRecords.clear();
}
