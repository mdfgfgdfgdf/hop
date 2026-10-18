/**
 * Server-Sent Events stream for the authenticated user. Emits:
 *   ride.updated / ride.offer / ride.offer.cancelled / driver.location /
 *   driver.availability / notification / ping (heartbeat every 15s)
 * Staff additionally receive the admin feed. Clients reconnect automatically
 * (EventSource) and should re-fetch state on reconnect.
 */
import { requireUser } from "@/server/auth/guards";
import { errorResponse } from "@/server/api";
import { channels, subscribe, type RealtimeEvent } from "@/server/realtime/bus";
import { ensureScheduler } from "@/server/dispatch/scheduler";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    return errorResponse(err);
  }
  ensureScheduler();
  const chans = [channels.user(user.id)];
  if (user.role === "admin" || user.role === "support") chans.push(channels.admin);

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: NodeJS.Timeout | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (e: RealtimeEvent) => {
        try {
          controller.enqueue(encoder.encode(`id: ${e.id}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* stream closed */
        }
      };
      controller.enqueue(encoder.encode(`retry: 2000\n\n`));
      send({ id: "0", type: "ping", at: new Date().toISOString(), data: { hello: user.id } });
      unsubscribe = subscribe(chans, send);
      heartbeat = setInterval(() => send({ id: "hb", type: "ping", at: new Date().toISOString(), data: null }), 15_000);
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  req.signal.addEventListener("abort", () => {
    unsubscribe?.();
    if (heartbeat) clearInterval(heartbeat);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
