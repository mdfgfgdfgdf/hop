"use client";
/** /lab/fluid — every HOP Fluid primitive over the live map. Values here are synthetic. */
import { useEffect, useState } from "react";
import { MapView } from "@/components/map";
import { DragSheet, HopBurst, Island, IslandEta, LiquidLensDefs, Morph, RollingNumber, SwipeConfirm, VehicleArt } from "@/components/fluid";
import { formatILS } from "@/lib/format";

const PRICES = [4290, 4710, 3980, 12850, 5120];
const STATES = [
  { tone: "brand" as const, mark: "loading" as const, title: "מחפשים לך נהג", subtitle: "סורקים 6 רכבים באזור" },
  { tone: "brand" as const, mark: "moving" as const, title: "דני בדרך אליך", subtitle: "טויוטה קורולה לבנה · 12-345-67" },
  { tone: "success" as const, mark: "success" as const, title: "הנהג הגיע", subtitle: "מחכה לך בכניסה" },
  { tone: "ink" as const, mark: "moving" as const, title: "בדרך ליעד", subtitle: "הגעה ב-14:32" },
];

export function FluidLab() {
  const [i, setI] = useState(0);
  const [burst, setBurst] = useState(0);
  const [snap, setSnap] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => x + 1), 2200);
    return () => clearInterval(id);
  }, []);
  const st = STATES[i % STATES.length];
  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <LiquidLensDefs />
      <MapView center={{ lat: 32.0752, lng: 34.7751 }} zoom={15.4} pitch={50} markers={[{ id: "p", kind: "pickup", lat: 32.0752, lng: 34.7751 }]} radar={{ lat: 32.0752, lng: 34.7751 }} />
      <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-3">
        <Island tone={st.tone} mark={st.mark} hopKey={i % STATES.length} title={st.title} subtitle={st.subtitle} trailing={<IslandEta minutes={4 + (i % 3)} />} expanded={i % 4 === 1} onClick={() => setBurst((b) => b + 1)}>
          <div className="flex items-center justify-between text-sm font-bold">
            <span>קוד אימות</span>
            <span className="text-xl tracking-[0.3em]">4 8 2 1</span>
          </div>
        </Island>
      </div>
      <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
        <HopBurst burstKey={burst || null} size={260} />
      </div>
      <div className="liquid-lens glass glass-strong absolute start-4 top-28 z-20 w-56 rounded-3xl p-4">
        <div className="text-xs font-bold text-ink-500">מחיר מוערך</div>
        <RollingNumber value={formatILS(PRICES[i % PRICES.length])} className="text-4xl font-black text-ink" />
      </div>
      <DragSheet snaps={[260, 0.62, 0.9]} snap={snap} onSnapChange={setSnap} aria-label="לוח בדיקה" header={<div className="px-5 pb-2 text-lg font-black">בחירת נסיעה</div>}>
        <div className="space-y-4 px-5 pb-6">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {["taxi", "taxi_xl", "premium", "accessible", "rideshare"].map((k, n) => (
              <div key={k} className={`glass shrink-0 rounded-3xl p-3 ${n === i % 4 ? "ring-2 ring-brand" : ""}`}>
                <VehicleArt kind={k} width={120} moving={n === i % 4} muted={k === "rideshare"} />
                <div className="mt-1 text-sm font-bold">{k}</div>
              </div>
            ))}
          </div>
          <Morph k={String(i % 3)}>
            <div className="glass rounded-3xl p-4">
              {i % 3 === 0 && <p className="font-bold">שלב א׳ — תוכן קצר.</p>}
              {i % 3 === 1 && (
                <div className="space-y-2">
                  <p className="font-bold">שלב ב׳ — תוכן ארוך יותר שמשנה גובה.</p>
                  <p>שורה נוספת.</p>
                  <p>ועוד אחת.</p>
                </div>
              )}
              {i % 3 === 2 && <p className="font-bold">שלב ג׳.</p>}
            </div>
          </Morph>
          <SwipeConfirm label="החליקו להזמנה" doneLabel="מזמינים…" onConfirm={() => new Promise((r) => setTimeout(r, 800))} data-testid="lab-swipe" />
          <SwipeConfirm label="החליקו לסיום נסיעה" tone="success" requireSwipe onConfirm={() => setBurst((b) => b + 1)} />
        </div>
      </DragSheet>
    </div>
  );
}
