"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Building2, Clock, LocateFixed, MapPin, MapPinned, Search, TrainFront, X } from "lucide-react";
import { api } from "@/lib/api";
import { formatDistance } from "@/lib/format";
import type { PlaceDTO } from "@/lib/types";
import { Skeleton } from "@/components/ui";
import { describeError, isAbort, type FriendlyError } from "../lib/errors";
import { distanceM } from "../lib/geo";
import type { RecentPlace } from "../lib/storage";
import { InlineError } from "../InlineError";
import { NeedleGauge, StaggerItem, StaggerList } from "../motion";
import { placeLabel, type SelectedPlace } from "./types";

type Results = { q: string; places: PlaceDTO[]; error?: FriendlyError };

const KIND_ICON = { poi: MapPin, address: MapPin, transit: TrainFront, city: Building2 } as const;

/** Full-height destination search: debounced geo search near the pickup, recents, pick on map. */
export function DestinationSearch({
  pickup,
  recents,
  onClose,
  onPick,
  onPickOnMap,
  onEditPickup,
}: {
  pickup: SelectedPlace | null;
  recents: RecentPlace[];
  onClose: () => void;
  onPick: (p: PlaceDTO | RecentPlace) => void;
  onPickOnMap: () => void;
  onEditPickup: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const term = q.trim();
  const nearLat = pickup?.lat;
  const nearLng = pickup?.lng;

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!term) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      const near = nearLat != null && nearLng != null ? { lat: nearLat, lng: nearLng } : null;
      api.geo
        .search(term, near, ctrl.signal)
        .then((r) => setResults({ q: term, places: r.places }))
        .catch((err) => {
          if (!isAbort(err)) setResults({ q: term, places: [], error: describeError(err) });
        });
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term, nearLat, nearLng]);

  const current = results && results.q === term ? results : null;
  const searching = term.length > 0 && !current;

  return (
    <motion.section
      role="dialog"
      aria-label="חיפוש יעד"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: "spring", stiffness: 400, damping: 36 }}
      className="glass glass-strong fixed inset-2 z-40 flex flex-col overflow-hidden safe-top lg:absolute lg:inset-auto lg:start-4 lg:top-4 lg:bottom-4 lg:w-[420px]"
    >
      <div className="flex items-center gap-2 px-3 pt-3">
        <button type="button" onClick={onClose} className="btn btn-ghost btn-icon shrink-0" aria-label="חזרה">
          <ArrowRight size={22} aria-hidden />
        </button>
        <h2 className="text-lg font-extrabold">לאן נוסעים?</h2>
      </div>

      <div className="px-4 pt-2 pb-3">
        <div className="relative rounded-[22px] border border-line bg-surface/80 p-1.5 shadow-[inset_0_1px_2px_rgba(17,19,24,.04)] transition-shadow focus-within:border-brand/50 focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_14%,transparent)]">
          <span className="absolute start-[22px] top-[30px] bottom-[30px] w-0.5 rounded-full bg-[color-mix(in_oklab,var(--fg)_14%,transparent)]" aria-hidden />
          <button type="button" onClick={onEditPickup} className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-2.5 text-start hover:bg-[color-mix(in_oklab,var(--fg)_4%,transparent)]">
            <span className="relative z-[1] h-4 w-4 shrink-0 rounded-full border-[3px] border-surface bg-brand shadow-[0_0_0_1px_var(--line-strong)]" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-bold text-fg-muted">איסוף</span>
              {pickup ? <span className="block truncate text-sm font-semibold">{placeLabel(pickup)}</span> : <Skeleton className="mt-1 h-3.5 w-32" />}
            </span>
            <span className="text-xs font-bold text-brand">שינוי</span>
          </button>
          <div className="divider ms-10 me-2" />
          <label className="flex min-h-12 items-center gap-3 px-2.5">
            <span className="relative z-[1] h-4 w-4 shrink-0 rounded-[5px] border-[3px] border-surface bg-ink shadow-[0_0_0_1px_var(--line-strong)]" aria-hidden />
            <span className="sr-only">יעד</span>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חפשו כתובת או מקום"
              className="h-11 min-w-0 flex-1 bg-transparent text-base font-semibold outline-none! placeholder:font-normal"
              enterKeyHint="search"
              autoComplete="off"
              data-testid="destination-input"
            />
            {q ? (
              <button type="button" onClick={() => setQ("")} className="grid h-9 w-9 place-items-center rounded-full text-fg-muted hover:bg-[color-mix(in_oklab,var(--fg)_6%,transparent)]" aria-label="ניקוי החיפוש">
                <X size={18} aria-hidden />
              </button>
            ) : (
              <Search size={18} className="me-2 text-fg-muted" aria-hidden />
            )}
          </label>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <button type="button" onClick={onPickOnMap} className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-start hover:bg-[color-mix(in_oklab,var(--fg)_5%,transparent)]" data-testid="pick-on-map">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 text-brand">
            <MapPinned size={19} aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-semibold">בחירה על המפה</span>
            <span className="block text-xs text-fg-muted">הזיזו את המפה ומקמו את הסיכה</span>
          </span>
        </button>
        <div className="divider my-1 mx-3" />

        {!term && (
          <>
            <div className="px-3 pt-3 pb-1 text-xs font-bold text-fg-muted">יעדים אחרונים</div>
            {recents.length === 0 ? (
              <p className="px-3 py-3 text-sm text-fg-muted">עוד לא נסעתם איתנו לשום מקום — הקלידו כתובת או שם של מקום, ואנחנו נמצא אותו.</p>
            ) : (
              <StaggerList>
                {recents.map((p) => (
                  <PlaceRow key={`${p.lat},${p.lng}`} icon={<Clock size={18} aria-hidden />} title={p.name} subtitle={p.address} onClick={() => onPick(p)} />
                ))}
              </StaggerList>
            )}
          </>
        )}

        {term && searching && (
          <div className="space-y-3 px-3 pt-3" aria-busy="true">
            <div className="flex items-center gap-2 text-xs font-semibold text-fg-muted">
              <NeedleGauge size={20} label="מחפשים…" /> מחפשים את &quot;{term}&quot;…
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {term && current?.error && <InlineError className="mx-2 mt-3" error={current.error} />}

        {term && current && !current.error && current.places.length === 0 && (
          <div className="px-3 py-8 text-center">
            <div className="text-sm font-bold">הממ… לא מצאנו את &quot;{term}&quot;</div>
            <p className="mt-1 text-sm text-fg-muted">נסו שם אחר או כתובת מלאה — או פשוט סמנו את היעד על המפה.</p>
          </div>
        )}

        {term && current && current.places.length > 0 && (
          <StaggerList key={current.q} testId="search-results">
            {current.places.map((p) => {
              const Icon = KIND_ICON[p.kind ?? "poi"];
              const dist = pickup ? distanceM(pickup, p) : null;
              return (
                <PlaceRow
                  key={p.id}
                  icon={<Icon size={18} aria-hidden />}
                  title={p.name}
                  subtitle={p.address}
                  meta={dist != null ? formatDistance(dist) : undefined}
                  onClick={() => onPick(p)}
                />
              );
            })}
          </StaggerList>
        )}

        {!pickup && (
          <p className="mt-4 flex items-center gap-2 px-3 text-xs text-fg-muted">
            <LocateFixed size={14} aria-hidden /> מאתרים את המיקום שלכם…
          </p>
        )}
      </div>
    </motion.section>
  );
}

function PlaceRow({ icon, title, subtitle, meta, onClick }: { icon: React.ReactNode; title: string; subtitle: string; meta?: string; onClick: () => void }) {
  return (
    <StaggerItem>
      <button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 py-2 text-start hover:bg-[color-mix(in_oklab,var(--fg)_5%,transparent)]">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--fg)_7%,transparent)] text-fg-muted">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{title}</span>
          <span className="block truncate text-xs text-fg-muted">{subtitle}</span>
        </span>
        {meta && <span className="shrink-0 text-xs font-semibold text-fg-muted tabular-nums">{meta}</span>}
      </button>
    </StaggerItem>
  );
}
