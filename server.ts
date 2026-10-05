import dotenv from "dotenv";
import { createCampfireServer } from "./src/server/index.js";
import { logInfo, logWarn } from "./src/server/logger.js";

dotenv.config();

const port = parseInt(process.env.PORT || "3000", 10);
const serveNext = process.env.SERVE_NEXT === "true";

async function start() {
  const server = createCampfireServer({ port });

  if (serveNext) {
    logInfo("Starting with Next.js integrated handler...");
    const next = (await import("next")).default;
    const dev = process.env.NODE_ENV !== "production";
    const nextApp = next({ dev });
    const handle = nextApp.getRequestHandler();
    await nextApp.prepare();

    server.app.all("*", (req, res) => {
      return handle(req, res);
    });
  }

  await server.listen(port);

  const shutdown = async (signal: string) => {
    logInfo(`🔥 ${signal} received. Initiating graceful shutdown...`);
    try {
      await server.close();
      logInfo("Clean shutdown complete.");
      process.exit(0);
    } catch (err) {
      logWarn("Error during shutdown:", { error: String(err) });
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
