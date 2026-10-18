/**
 * Client helpers for live traffic on a route: turn the server's congested
 * spans (polyline point indices) into drawable segments, and describe the
 * delay honestly. No traffic data → nothing is drawn or claimed.
 */
import type { Polyline, RouteTrafficDTO, TrafficLevel, TrafficSpan } from "./types";

export type TrafficSegment = { level: TrafficLevel; coords: Polyline };

export const TRAFFIC_COLORS: Record<TrafficLevel, string> = {
  moderate: "#f59f0a",
  heavy: "#e5484d",
  severe: "#a51d2d",
};

export const TRAFFIC_LABELS: Record<TrafficLevel, string> = {
  moderate: "תנועה איטית",
  heavy: "עומס כבד",
  severe: "פקק",
};

/**
 * Segments of `polyline` covered by `spans`. Pass `fromIndex` when only the
 * remainder of the route is shown (e.g. during a ride): spans that end before
 * it are dropped and the first one is cut to start there (at `head` if given).
 */
export function trafficSegments(polyline: Polyline | null | undefined, spans: TrafficSpan[] | null | undefined, fromIndex = 0, head?: [number, number]): TrafficSegment[] {
  if (!polyline || polyline.length < 2 || !spans?.length) return [];
  const out: TrafficSegment[] = [];
  for (const s of spans) {
    if (s.to <= fromIndex) continue;
    const start = Math.max(s.from, fromIndex);
    const coords = polyline.slice(start, s.to + 1) as Polyline;
    if (head && s.from < fromIndex) coords.unshift(head);
    if (coords.length >= 2) out.push({ level: s.level, coords });
  }
  return out;
}

/** Extra minutes caused by traffic, when the provider reports a free-flow time. */
export function trafficDelayMin(traffic: RouteTrafficDTO | null | undefined, durationS: number): number | null {
  if (!traffic || traffic.durationNoTrafficS == null) return null;
  const min = Math.round((durationS - traffic.durationNoTrafficS) / 60);
  return min > 0 ? min : 0;
}

/** The worst level along the route, or null when it flows freely. */
export function worstLevel(spans: TrafficSpan[] | null | undefined): TrafficLevel | null {
  if (!spans?.length) return null;
  if (spans.some((s) => s.level === "severe")) return "severe";
  if (spans.some((s) => s.level === "heavy")) return "heavy";
  return "moderate";
}
