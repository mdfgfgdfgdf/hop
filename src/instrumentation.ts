/** Runs once when the Next.js server starts (Node runtime only). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getDb } = await import("./server/db/client");
    const { ensureScheduler } = await import("./server/dispatch/scheduler");
    try {
      await getDb();
      ensureScheduler();
    } catch (err) {
      console.error("[instrumentation] startup failed", err);
    }
  }
}
