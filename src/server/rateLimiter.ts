/**
 * In-memory sliding window rate limiter for WebSocket events per socket ID or IP address.
 */
interface RateLimitConfig {
  maxEvents: number;
  windowMs: number;
}

const eventRecords = new Map<string, number[]>();
const activeIpConnections = new Map<string, number>();

const MAX_CONNECTIONS_PER_IP = 10;

export function checkRateLimit(socketId: string, eventName: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const key = `socket:${socketId}:${eventName}`;
  const timestamps = eventRecords.get(key) || [];

  const validTimestamps = timestamps.filter((t) => now - t < config.windowMs);

  if (validTimestamps.length >= config.maxEvents) {
    return false;
  }

  validTimestamps.push(now);
  eventRecords.set(key, validTimestamps);
  return true;
}

export function checkIpRateLimit(ip: string, eventName: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const key = `ip:${ip}:${eventName}`;
  const timestamps = eventRecords.get(key) || [];

  const validTimestamps = timestamps.filter((t) => now - t < config.windowMs);

  if (validTimestamps.length >= config.maxEvents) {
    return false;
  }

  validTimestamps.push(now);
  eventRecords.set(key, validTimestamps);
  return true;
}

export function registerIpConnection(ip: string): boolean {
  const current = activeIpConnections.get(ip) || 0;
  if (current >= MAX_CONNECTIONS_PER_IP) {
    return false; // Connection limit exceeded for this IP
  }
  activeIpConnections.set(ip, current + 1);
  return true;
}

export function unregisterIpConnection(ip: string): void {
  const current = activeIpConnections.get(ip) || 0;
  if (current <= 1) {
    activeIpConnections.delete(ip);
  } else {
    activeIpConnections.set(ip, current - 1);
  }
}

export function cleanupRateLimits(socketId: string): void {
  for (const key of eventRecords.keys()) {
    if (key.startsWith(`socket:${socketId}:`)) {
      eventRecords.delete(key);
    }
  }
}

export function resetRateLimitsForTesting(): void {
  eventRecords.clear();
  activeIpConnections.clear();
}
