/**
 * Landing sections (server components). Clean and confident: white and paper
 * surfaces, ink type, one blue primary action per section; glass only on
 * small floating elements. Every number is either server-computed from the
 * live tariff and labelled "דוגמה", or a policy value read from the config.
 */
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, LocateFixed, MessagesSquare, Search, Share2, ShieldCheck, Siren, Users } from "lucide-react";
import { AnimatedLogo } from "@/components/brand/AnimatedLogo";
import { VehicleArt } from "@/components/fluid";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { cn } from "@/components/ui/cn";
import { formatILS } from "@/lib/money";
import { percentFromBp } from "@/lib/format";
import { DOCUMENT_TYPE_HE } from "@/lib/labels";
import { DEMO_ACCOUNTS } from "@/server/db/seed";
import { Reveal } from "./fx";
import { HeroMap } from "./HeroMap";
import { PriceExplorer } from "./PriceExplorer";
import type { LandingData } from "./example-fare";

const minutesHe = (sec: number) => {
  const m = Math.round(sec / 60);
  return m === 1 ? "דקה" : m === 2 ? "שתי דקות" : `${m} דקות`;
};

function SectionHead({ id, eyebrow, title, text, className }: { id: string; eyebrow: string; title: string; text?: string; className?: string }) {
  return (
    <Reveal className={className}>
      <p className="lp-eyebrow">{eyebrow}</p>
      <h2 id={id} className="lp-h2 mt-3">
        {title}
      </h2>
      {text && <p className="lp-lead mt-4">{text}</p>}
    </Reveal>
  );
}

// ───────────────────────────── hero ─────────────────────────────

export function Hero({ demo, rideHref, driveHref, signedIn, examplePrice }: { demo: boolean; rideHref: string; driveHref: string; signedIn: boolean; examplePrice: number }) {
  return (
    <section id="ride" aria-labelledby="hero-title" className="lp-hero">
      <div className="lp-wrap grid items-center gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-14">
        <div className="lp-hero-copy">
          <div className="flex flex-wrap items-center gap-2">
            <span className="pill pill-brand">פיילוט בתל אביב–יפו</span>
            {demo && <DemoBanner />}
          </div>
          <h1 id="hero-title" className="lp-display mt-5">
            <span className="sr-only">HOP — </span>
            <span className="block">העיר שלך.</span>{" "}
            <span className="block">
              <span className="text-brand">הופ</span> אחד.
            </span>
          </h1>
          <p className="lp-lead mt-5 max-w-[34rem]">מוניות מורשות בלחיצה. רואים מחיר מלא לפני שמזמינים, הנהג רואה בדיוק כמה הוא מקבל, והעמלה גלויה לשניכם.</p>

          <div className="lp-where mt-7">
            <div className="lp-where-fields">
              <Link href={rideHref} className="lp-where-row">
                <span className="lp-where-dot" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-fg-muted">איסוף</span>
                  <span className="block truncate font-bold">המיקום הנוכחי</span>
                </span>
                <LocateFixed size={18} className="shrink-0 text-fg-muted" aria-hidden />
              </Link>
              <Link href={rideHref} className="lp-where-row">
                <span className="lp-where-square" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-fg-muted">יעד</span>
                  <span className="block truncate font-bold">לאן נוסעים?</span>
                </span>
                <Search size={18} className="shrink-0 text-fg-muted" aria-hidden />
              </Link>
            </div>
            <Link href={rideHref} className="btn btn-primary btn-lg btn-block mt-3">
              להזמין נסיעה
              <ArrowLeft size={18} aria-hidden />
            </Link>
            <p className="mt-3 text-center text-xs font-medium text-fg-muted">
              {signedIn ? "מחיר מלא לפני ההזמנה · ביטול חינם עד שנהג מאשר" : "הרשמה של דקה · מחיר מלא לפני ההזמנה"}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href={driveHref} className="lp-text-link">
              נהגו עם HOP
              <ArrowLeft size={16} aria-hidden />
            </Link>
            {!signedIn && (
              <span className="text-sm text-fg-muted">
                כבר רשומים?{" "}
                <Link href="/login" className="font-bold text-fg underline-offset-4 hover:underline">
                  התחברות
                </Link>
              </span>
            )}
          </div>
        </div>
        <HeroMap examplePrice={examplePrice} />
      </div>
    </section>
  );
}

// ───────────────────────────── ride options ─────────────────────────────

export function RideOptions({ data, rideHref, signedIn }: { data: LandingData; rideHref: string; signedIn: boolean }) {
  const city = data.trips.find((t) => t.id === "city") ?? data.trips[0];
  return (
    <section id="options" aria-labelledby="options-title" className="lp-section lp-paper">
      <div className="lp-wrap">
        <SectionHead
          id="options-title"
          eyebrow="אפשרויות נסיעה"
          title="נסיעה שמתאימה לכל יציאה"
          text={`כל הנסיעות ב־HOP הן עם נהגים מורשים ומאומתים. המחירים הם דוגמה לנסיעה של ${city.km} ק״מ ו־${city.minutes} דקות בשעות היום.`}
        />
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {data.options.map((o, i) => (
            <li key={o.id} className={cn("lp-option", !o.enabled && "is-off")}>
              <Reveal delay={i * 0.05} className="h-full">
                <div className="lp-option-inner">
                  <div className="lp-option-art">
                    <VehicleArt kind={o.id} width={150} muted={!o.enabled} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[17px] leading-snug font-extrabold">{o.name}</h3>
                    {o.enabled && <p className="mt-1 text-sm leading-relaxed text-fg-muted">{o.description}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                      <span className="inline-flex items-center gap-1 font-semibold text-fg-muted">
                        <Users size={15} aria-hidden />
                        עד {o.seats}
                        <span className="sr-only">נוסעים</span>
                      </span>
                      {o.enabled ? (
                        <span className="font-bold">
                          <span className="text-xs font-semibold text-fg-muted">דוגמה </span>
                          <span className="ltr-nums">{formatILS(o.examplePrice)}</span>
                        </span>
                      ) : (
                        <span className="lp-soon">בקרוב — מחייב אישור רגולטורי</span>
                      )}
                    </div>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <Link href={rideHref} className="btn btn-primary">
            {signedIn ? "לאפליקציית הנסיעות" : "פותחים חשבון ונוסעים"}
            <ArrowLeft size={18} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────── safety ─────────────────────────────

const SAFETY = [
  { icon: ShieldCheck, title: "נהגים מאומתים", text: "לפני הנסיעה הראשונה צוות HOP בודק ידנית רישיון נהיגה, היתר להסעת נוסעים, רישיון מונית, רישיון רכב וביטוח." },
  { icon: Share2, title: "שיתוף הנסיעה", text: "שולחים בלחיצה את פרטי הנהג והרכב, היעד וזמן ההגעה המשוער למי שתרצו." },
  { icon: Siren, title: "מרכז בטיחות בנסיעה", text: "חיוג מהיר למשטרה ולמד״א, ודיווח דחוף לצוות הבטיחות של HOP — ישר ממסך הנסיעה." },
  { icon: MessagesSquare, title: "תמיכה עם מעקב", text: "פונים מתוך האפליקציה ומקבלים תשובה בשרשור עם סטטוס. פניות בטיחות מסומנות כדחופות." },
] as const;

export function Safety() {
  return (
    <section id="safety" aria-labelledby="safety-title" className="lp-section lp-white">
      <div className="lp-wrap">
        <SectionHead id="safety-title" eyebrow="בטיחות" title="בטיחות מובנית בכל נסיעה" text="מהבדיקה של הנהג לפני הנסיעה הראשונה ועד הדיווח אחרי שירדתם — הכלים נמצאים בתוך האפליקציה, לא בהבטחות." />
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SAFETY.map(({ icon: Icon, title, text }, i) => (
            <li key={title}>
              <Reveal delay={i * 0.06} className="lp-card lp-feature h-full">
                <span className="lp-icon" aria-hidden>
                  <Icon size={22} />
                </span>
                <h3 className="mt-5 text-[17px] font-extrabold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{text}</p>
              </Reveal>
            </li>
          ))}
        </ul>
        <Reveal className="lp-sos mt-4">
          <Siren size={18} className="shrink-0" aria-hidden />
          <p>
            בסכנה מיידית — קודם כל מתקשרים:{" "}
            <a href="tel:100" className="font-extrabold underline-offset-4 hover:underline">
              משטרה <span className="ltr-nums">100</span>
            </a>{" "}
            ·{" "}
            <a href="tel:101" className="font-extrabold underline-offset-4 hover:underline">
              מד״א <span className="ltr-nums">101</span>
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ───────────────────────────── price ─────────────────────────────

export function Price({ data }: { data: LandingData }) {
  const commission = `${percentFromBp(data.commissionPercentBp)} ממחיר הנסיעה${data.commissionFixedAgorot > 0 ? ` + ${formatILS(data.commissionFixedAgorot)}` : ""}${data.bookingFeeAgorot > 0 ? `, ודמי הזמנה של ${formatILS(data.bookingFeeAgorot)}` : ""}`;
  const points = [
    "מחיר מלא לפני ההזמנה — בלי מונה שרץ ובלי הפתעות בסוף.",
    `עמלת HOP גלויה: ${commission}.`,
    "הנהג רואה את התשלום נטו לפני שהוא מאשר נסיעה.",
    `ביטול חינם עד שנהג מאשר, ועוד ${minutesHe(data.freeCancelWindowSec)} אחרי.`,
  ];
  const night = data.nightMultiplierBp > 10000 ? `בין ${data.nightStart} ל־${data.nightEnd} חלה תוספת לילה של ${percentFromBp(data.nightMultiplierBp - 10000)}, והיא מופיעה כשורה נפרדת.` : null;
  return (
    <section id="price" aria-labelledby="price-title" className="lp-section lp-paper">
      <div className="lp-wrap grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <SectionHead id="price-title" eyebrow="מחיר שקוף" title="כל שקל מוסבר. לפני שמזמינים." text="המחיר מחושב בשרת לפי מרחק, זמן ושעה, ונעול להזמנה. אותו פירוט רואים הנוסע, הנהג וצוות HOP." />
          <ul className="mt-8 grid gap-3.5">
            {points.map((p, i) => (
              <li key={p}>
                <Reveal delay={i * 0.05} className="flex items-start gap-3">
                  <span className="lp-check" aria-hidden>
                    <Check size={14} strokeWidth={3} />
                  </span>
                  <span className="text-[15px] leading-relaxed">{p}</span>
                </Reveal>
              </li>
            ))}
          </ul>
          {night && <p className="mt-6 text-sm leading-relaxed text-fg-muted">{night}</p>}
        </div>
        <Reveal delay={0.08}>
          <PriceExplorer trips={data.trips} commissionPercentBp={data.commissionPercentBp} bookingFeeAgorot={data.bookingFeeAgorot} demoTariff={data.demoTariff} />
        </Reveal>
      </div>
    </section>
  );
}

// ───────────────────────────── drivers ─────────────────────────────

export function Drivers({ data, driveHref, signedIn }: { data: LandingData; driveHref: string; signedIn: boolean }) {
  const trip = data.trips.find((t) => t.id === "city") ?? data.trips[0];
  const docs = Object.values(DOCUMENT_TYPE_HE);
  const steps = [
    { title: "נרשמים כנהג/ת", text: "פרטים אישיים ופרטי הרכב, בכמה דקות." },
    { title: "מעלים מסמכים", text: `${docs.slice(0, -1).join(", ")} ו${docs[docs.length - 1]}.` },
    { title: "צוות HOP בודק ומאשר", text: "כל מסמך נבדק ידנית, כולל תוקף. עד לאישור לא מקבלים נסיעות." },
    { title: "מתחברים ומקבלים הצעות", text: "כל הצעה מציגה את התשלום נטו לפני שמאשרים, וסיכום ההכנסות זמין באפליקציה." },
  ];
  return (
    <section id="drive" aria-labelledby="drive-title" className="lp-section lp-white">
      <div className="lp-wrap grid items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
        <div>
          <SectionHead id="drive-title" eyebrow="לנהגים" title="נוהגים מתי שרוצים. יודעים בדיוק כמה נכנס." text="ב־HOP העמלה קבועה וגלויה, והתשלום נטו מופיע על כל הצעה לפני שמאשרים. בלי אותיות קטנות." />
          <ol className="lp-steps mt-8">
            {steps.map((s, i) => (
              <li key={s.title}>
                <Reveal delay={i * 0.06} className="lp-step">
                  <span className="lp-step-num ltr-nums" aria-hidden>
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-extrabold">{s.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-fg-muted">{s.text}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href={driveHref} className="btn btn-primary btn-lg">
              {signedIn ? "לאפליקציית הנהגים" : "להרשמה כנהג/ת"}
              <ArrowLeft size={18} aria-hidden />
            </Link>
            {!signedIn && (
              <Link href="/login?next=/drive" className="lp-text-link">
                כבר נוהגים עם HOP? כניסה
              </Link>
            )}
          </div>
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-fg-muted">כרגע HOP פועלת עם נהגי מוניות מורשים בלבד. שירות נהג פרטי (שיתוף נסיעות) כבוי עד לאישור רגולטורי וביטוחי.</p>
        </div>

        <Reveal delay={0.08}>
          <div className="lp-card lp-earn" data-testid="landing-driver-example">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold">מה נכנס לך מנסיעה</h3>
                <p className="mt-0.5 text-sm text-fg-muted">
                  נסיעה של {trip.km} ק״מ · {trip.minutes} דק׳
                </p>
              </div>
              <span className="pill pill-warning shrink-0">דוגמה</span>
            </div>
            <div className="lp-earn-art" aria-hidden>
              <VehicleArt kind="taxi" width={230} />
            </div>
            <dl className="grid gap-2.5 text-[15px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-muted">הנוסע משלם</dt>
                <dd className="ltr-nums font-semibold">{formatILS(trip.riderTotal)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-muted">
                  עמלת HOP ({percentFromBp(data.commissionPercentBp)}
                  {data.bookingFeeAgorot > 0 ? " + דמי הזמנה" : ""})
                </dt>
                <dd className="ltr-nums font-semibold">{formatILS(-trip.hopCommission)}</dd>
              </div>
            </dl>
            <div className="lp-rule my-4" />
            <div className="flex items-end justify-between gap-3">
              <div className="font-bold">התשלום שלך, נטו</div>
              <div className="ltr-nums text-[2rem] leading-none font-black text-brand">{formatILS(trip.driverPayout)}</div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-fg-muted">חישוב לדוגמה לפי {data.demoTariff ? "תעריף ההדגמה (לא תעריף רשמי)" : "התעריף הפעיל"}. בהצעה האמיתית מופיע הסכום המדויק של אותה נסיעה.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ───────────────────────────── FAQ ─────────────────────────────

export function Faq({ data, demo }: { data: LandingData; demo: boolean }) {
  const items: { q: string; a: string }[] = [
    {
      q: "איך מחושב המחיר?",
      a: `דמי התחלה, מרחק וזמן נסיעה${data.bookingFeeAgorot > 0 ? ", ועוד דמי הזמנה" : ""}. המחיר מחושב בשרת לפני ההזמנה ונעול ל־${minutesHe(data.quoteTtlSec)} — מה שרואים הוא מה שמשלמים.`,
    },
    {
      q: "כמה מקבל הנהג וכמה לוקחת HOP?",
      a: `עמלת HOP היא ${percentFromBp(data.commissionPercentBp)} ממחיר הנסיעה${data.bookingFeeAgorot > 0 ? ", ודמי ההזמנה עוברים ל־HOP" : ""}. כל השאר עובר לנהג. הנוסע והנהג רואים את אותו פירוט.`,
    },
    {
      q: "אפשר לבטל?",
      a: `כן. ביטול חינם עד שנהג מאשר, ועוד ${minutesHe(data.freeCancelWindowSec)} אחרי האישור. אחר כך ייתכנו דמי ביטול של עד ${formatILS(data.cancellationFeeAgorot)}, ולעולם לא יותר ממחיר הנסיעה.`,
    },
    { q: "יש ב־HOP נהגים פרטיים?", a: "לא. כרגע פועלים נהגי מוניות מורשים בלבד. שירות נהג פרטי (שיתוף נסיעות) כבוי, ויופעל רק לאחר אישור רגולטורי וביטוחי." },
    { q: "איך HOP בודקת נהגים?", a: "כל נהג מעלה תעודת זהות, רישיון נהיגה, היתר להסעת נוסעים בשכר, רישיון מונית, רישיון רכב, ביטוח ותמונת רכב. צוות HOP בודק כל מסמך ידנית לפני הנסיעה הראשונה." },
    { q: "איפה השירות פועל?", a: "HOP נמצאת בפיילוט בתל אביב–יפו וגוש דן. אזור השירות מוצג באפליקציה בזמן ההזמנה." },
    { q: "איך פונים לתמיכה?", a: "מתוך האפליקציה, במסך התמיכה או ישירות ממסך הנסיעה. בסכנה מיידית — חייגו קודם 100 (משטרה) או 101 (מד״א)." },
    ...(demo ? [{ q: "מה זה ״סביבת הדגמה״?", a: "בסביבת ההדגמה הנהגים, הנסיעות והתשלומים מדומים ומסומנים ככאלה, כדי שאפשר יהיה לנסות את האפליקציה בלי נסיעה אמיתית. שום נתון הדגמה לא מוצג כאמיתי." }] : []),
  ];
  return (
    <section id="faq" aria-labelledby="faq-title" className="lp-section lp-paper">
      <div className="lp-wrap grid items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <SectionHead id="faq-title" eyebrow="שאלות נפוצות" title="שאלות? יש תשובות." text="הדברים שהכי חשוב לדעת לפני הנסיעה הראשונה — ולפני המשמרת הראשונה." />
        <Reveal delay={0.06}>
          <div className="lp-faq">
            {items.map((it) => (
              <details key={it.q} className="lp-faq-item">
                <summary>
                  <span>{it.q}</span>
                  <ChevronDown size={20} className="lp-faq-chev shrink-0" aria-hidden />
                </summary>
                <p>{it.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ───────────────────────────── closing CTA ─────────────────────────────

export function Closing({ appHref, driveHref }: { appHref: string | null; driveHref: string }) {
  return (
    <section aria-labelledby="closing-title" className="lp-section lp-white">
      <Reveal className="lp-wrap flex flex-col items-center text-center">
        <AnimatedLogo height={64} hopOn="hover" title="HOP" />
        <p className="mt-4 text-[11px] font-extrabold tracking-[0.3em] text-fg-muted" dir="ltr">
          MOVE WITH HOP
        </p>
        <h2 id="closing-title" className="lp-h2 mt-4">
          העיר מחכה. הופ.
        </h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href={appHref ?? "/signup"} className="btn btn-primary btn-lg">
            {appHref ? "המשך לאפליקציה" : "להרשמה ל־HOP"}
            <ArrowLeft size={18} aria-hidden />
          </Link>
          <Link href={driveHref} className="btn btn-glass btn-lg">
            נהגו עם HOP
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

// ───────────────────────────── demo accounts ─────────────────────────────

const ROLE_HE = { rider: "נוסע", driver: "נהג מאושר", support: "תמיכה", admin: "מנהל" } as const;

export function DemoAccounts() {
  return (
    <section aria-labelledby="demo-accounts" className="lp-white pb-16">
      <div className="lp-wrap">
        <div className="lp-card p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 id="demo-accounts" className="lp-eyebrow">
              חשבונות הדגמה
            </h2>
            <DemoBanner compact text="סביבת פיתוח" />
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {(["rider", "driver", "support", "admin"] as const).map((k) => (
              <div key={k} className="rounded-[18px] border border-line bg-paper p-3.5">
                <div className="font-extrabold">{ROLE_HE[k]}</div>
                <div className="mt-1 text-right text-xs text-fg-muted">
                  <span dir="ltr" className="inline-block">
                    {DEMO_ACCOUNTS[k].email}
                  </span>
                </div>
                <div className="text-right text-xs text-fg-muted">
                  סיסמה:{" "}
                  <span dir="ltr" className="inline-block font-mono text-fg">
                    {DEMO_ACCOUNTS[k].password}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────── footer ─────────────────────────────

export function LandingFooter({ demo }: { demo: boolean }) {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <AnimatedLogo height={30} color="#ffffff" hopOn="hover" title="HOP" />
            <p className="mt-3 text-sm text-white/80">העיר שלך. הופ אחד.</p>
            <p className="mt-1 text-[11px] font-extrabold tracking-[0.3em] text-white/70" dir="ltr">
              MOVE WITH HOP
            </p>
          </div>
          <nav aria-label="HOP">
            <h2 className="lp-footer-h">HOP</h2>
            <ul className="lp-footer-list">
              <li><a href="#options">אפשרויות נסיעה</a></li>
              <li><a href="#safety">בטיחות</a></li>
              <li><a href="#price">מחיר שקוף</a></li>
              <li><a href="#drive">נהיגה עם HOP</a></li>
              <li><a href="#faq">שאלות נפוצות</a></li>
            </ul>
          </nav>
          <nav aria-label="חשבון ומפעילים">
            <h2 className="lp-footer-h">חשבון</h2>
            <ul className="lp-footer-list">
              <li><Link href="/login">התחברות</Link></li>
              <li><Link href="/signup">הרשמה</Link></li>
              <li><Link href="/signup?role=driver">הרשמת נהגים</Link></li>
              <li><Link href="/login?next=/admin">מפעילים</Link></li>
            </ul>
          </nav>
          <nav aria-label="מידע משפטי">
            <h2 className="lp-footer-h">מידע משפטי</h2>
            <ul className="lp-footer-list">
              <li><Link href="/legal/terms">תנאי שימוש</Link></li>
              <li><Link href="/legal/privacy">מדיניות פרטיות</Link></li>
            </ul>
          </nav>
        </div>
        <div className="lp-footer-notes">
          <p>שירות נהג פרטי (שיתוף נסיעות) כבוי, ויופעל רק לאחר אישור רגולטורי וביטוחי. כיום פועלים ב־HOP נהגי מוניות מורשים בלבד.</p>
          <p>
            {demo
              ? "האתר פועל כעת בסביבת הדגמה: נהגים, נסיעות ותשלומים מדומים ומסומנים ככאלה. "
              : "ל־HOP יש גם מצב הדגמה לניסיון, שבו כל הנתונים מדומים ומסומנים. "}
            המפה, הנסיעה והמחירים בעמוד הזה הם המחשה ודוגמה בלבד; המחיר בפועל מחושב בכל הזמנה.
          </p>
          <p>© HOP · פיילוט בתל אביב–יפו. שירותים מסחריים יופעלו רק לאחר אישור רגולטורי וביטוחי.</p>
        </div>
      </div>
    </footer>
  );
}
