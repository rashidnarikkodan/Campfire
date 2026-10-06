/**
 * In-memory real-time metrics collector for Campfire.
 */

interface MetricsState {
  wsConnectionsTotal: number;
  wsDisconnectsTotal: number;
  reconnectsTotal: number;
  webrtcFailuresTotal: number;
  signalingErrorsTotal: number;
  turnUsageTotal: number;
  messagesSentTotal: number;
  campfiresCreatedTotal: number;
  joinFailuresTotal: number;
  closedCampfireDurations: number[];
}

const metrics: MetricsState = {
  wsConnectionsTotal: 0,
  wsDisconnectsTotal: 0,
  reconnectsTotal: 0,
  webrtcFailuresTotal: 0,
  signalingErrorsTotal: 0,
  turnUsageTotal: 0,
  messagesSentTotal: 0,
  campfiresCreatedTotal: 0,
  joinFailuresTotal: 0,
  closedCampfireDurations: [],
};

export const incrementMetric = {
  wsConnections: () => { metrics.wsConnectionsTotal++; },
  wsDisconnects: () => { metrics.wsDisconnectsTotal++; },
  reconnects: () => { metrics.reconnectsTotal++; },
  webrtcFailures: () => { metrics.webrtcFailuresTotal++; },
  signalingErrors: () => { metrics.signalingErrorsTotal++; },
  turnUsage: () => { metrics.turnUsageTotal++; },
  messagesSent: () => { metrics.messagesSentTotal++; },
  campfiresCreated: () => { metrics.campfiresCreatedTotal++; },
  joinFailures: () => { metrics.joinFailuresTotal++; },
};

export function recordCampfireDuration(durationMs: number) {
  metrics.closedCampfireDurations.push(durationMs);
  if (metrics.closedCampfireDurations.length > 500) {
    metrics.closedCampfireDurations.shift(); // Keep last 500 room durations
  }
}

export function getMetricsSnapshot(activeRooms: number, activePeers: number) {
  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();

  const totalDurations = metrics.closedCampfireDurations.reduce((a, b) => a + b, 0);
  const avgCampfireDurationMs =
    metrics.closedCampfireDurations.length > 0
      ? Math.round(totalDurations / metrics.closedCampfireDurations.length)
      : 0;

  return {
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    activeCampfires: activeRooms,
    activeParticipants: activePeers,
    counters: {
      wsConnectionsTotal: metrics.wsConnectionsTotal,
      wsDisconnectsTotal: metrics.wsDisconnectsTotal,
      reconnectsTotal: metrics.reconnectsTotal,
      webrtcFailuresTotal: metrics.webrtcFailuresTotal,
      signalingErrorsTotal: metrics.signalingErrorsTotal,
      turnUsageTotal: metrics.turnUsageTotal,
      messagesSentTotal: metrics.messagesSentTotal,
      campfiresCreatedTotal: metrics.campfiresCreatedTotal,
      joinFailuresTotal: metrics.joinFailuresTotal,
    },
    analytics: {
      avgCampfireDurationMs,
      avgCampfireDurationSeconds: Math.round(avgCampfireDurationMs / 1000),
    },
    system: {
      memoryHeapUsedMB: (memory.heapUsed / (1024 * 1024)).toFixed(2),
      memoryHeapTotalMB: (memory.heapTotal / (1024 * 1024)).toFixed(2),
      memoryRssMB: (memory.rss / (1024 * 1024)).toFixed(2),
      cpuUserMs: Math.round(cpu.user / 1000),
      cpuSystemMs: Math.round(cpu.system / 1000),
    },
    databaseLatencyMs: 0, // In-memory state, zero DB latency
    redisLatencyMs: 0,    // In-memory state, zero Redis latency
  };
}

export function resetMetricsForTesting() {
  metrics.wsConnectionsTotal = 0;
  metrics.wsDisconnectsTotal = 0;
  metrics.reconnectsTotal = 0;
  metrics.webrtcFailuresTotal = 0;
  metrics.signalingErrorsTotal = 0;
  metrics.turnUsageTotal = 0;
  metrics.messagesSentTotal = 0;
  metrics.campfiresCreatedTotal = 0;
  metrics.joinFailuresTotal = 0;
  metrics.closedCampfireDurations = [];
}
