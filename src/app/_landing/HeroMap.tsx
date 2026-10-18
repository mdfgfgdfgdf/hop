"use client";
/**
 * The hero's map visual: a calm, slightly pitched city with one illustrative
 * HOP ride on a loop (driver comes to Rabin Square, then drives to the port)
 * and a small glass Island narrating it. Not interactive — wheel and touch
 * scroll the page. Pauses off-screen; a still picture under reduced motion.
 */
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MapView } from "@/components/map";
import { Island, IslandEta } from "@/components/fluid";
import { formatILS } from "@/lib/money";
import { useStill } from "./fx";
import { DROPOFF_NAME, FRAME, PICKUP_NAME, STILL_SCENE, sceneAt, type RideStage } from "./scene";

const FIT_PADDING = { top: 104, bottom: 44, left: 40, right: 40 };
const TICK_MS = 500;

const ISLAND: Record<RideStage, { title: string; subtitle: (price: string) => string; mark: "moving" | "success" }> = {
  approach: { title: "הנהג בדרך אליך", subtitle: () => `מונית · איסוף מ${PICKUP_NAME}`, mark: "moving" },
  arrived: { title: "הנהג הגיע", subtitle: () => `מחכה לך ב${PICKUP_NAME}`, mark: "success" },
  ride: { title: `בדרך ל${DROPOFF_NAME}`, subtitle: (p) => `המחיר נעול · ${p}`, mark: "moving" },
  done: { title: "הגעתם. הופ!", subtitle: () => "הקבלה המלאה כבר באפליקציה", mark: "success" },
};

/** A map that cannot start (no WebGL, blocked worker) must never take the landing page down. */
class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("[landing] map unavailable", err);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function HeroMap({ examplePrice }: { examplePrice: number }) {
  const still = useStill();
  const rootRef = useRef<HTMLDivElement>(null);
  const visible = useRef(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (still) return;
    const t0 = performance.now();
    const id = window.setInterval(() => {
      if (visible.current && document.visibilityState === "visible") setTick(Math.round((performance.now() - t0) / TICK_MS));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [still]);

  const scene = useMemo(() => (still ? STILL_SCENE : sceneAt((tick * TICK_MS) / 1000)), [still, tick]);
  const copy = ISLAND[scene.stage];
  const price = formatILS(examplePrice);

  return (
    <figure ref={rootRef} className="lp-hero-map">
      <MapBoundary>
        <MapView
          center={FRAME[1]}
          zoom={14.4}
          pitch={38}
          bearing={-14}
          fit={FRAME}
          fitPadding={FIT_PADDING}
          interactive={false}
          markers={scene.markers}
          polyline={scene.polyline}
        />
      </MapBoundary>
      <div className="lp-hero-island" aria-hidden>
        <Island
          tone="glass"
          mark={copy.mark}
          hopKey={scene.stage}
          title={copy.title}
          subtitle={copy.subtitle(price)}
          trailing={scene.minutes > 0 && (scene.stage === "approach" || scene.stage === "ride") ? <IslandEta minutes={scene.minutes} /> : undefined}
          contentKey={scene.stage}
        />
      </div>
      <span className="lp-hero-map-tag pill pill-muted">המחשה</span>
      <figcaption className="sr-only">
        המחשה: נהג HOP מגיע לאיסוף ב{PICKUP_NAME} ומסיע אל {DROPOFF_NAME}, על מפת העיר.
      </figcaption>
    </figure>
  );
}
