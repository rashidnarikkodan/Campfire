export type LogLevel = "INFO" | "WARN" | "ERROR";

export type LogContext = {
  socketId?: string;
  roomId?: string;
  sessionId?: string;
  event?: string;
  result?: "success" | "failure" | "rate_limited" | "error";
  error?: string;
  [key: string]: unknown;
};

function formatLog(level: LogLevel, message: string, context: LogContext = {}) {
  // Ensure sensitive data (SDP, credentials, tokens) are never included
  const sanitizedContext = { ...context };
  delete sanitizedContext.sdp;
  delete sanitizedContext.candidate;
  delete sanitizedContext.credential;
  delete sanitizedContext.auth;

  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitizedContext,
  });
}

export function logInfo(message: string, context: LogContext = {}) {
  console.log(formatLog("INFO", message, context));
}

export function logWarn(message: string, context: LogContext = {}) {
  console.warn(formatLog("WARN", message, context));
}

export function logError(message: string, context: LogContext = {}) {
  console.error(formatLog("ERROR", message, context));
}
