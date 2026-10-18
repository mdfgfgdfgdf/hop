import Link from "next/link";
import { ArrowLeft, Car, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { getCurrentUser } from "@/server/auth/session";
import { homeFor } from "@/server/auth/redirects";
import { isDemoMode } from "@/server/env";
import { DEMO_ACCOUNTS } from "@/server/db/seed";
import { DemoBanner } from "@/components/ui/DemoBanner";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const user = await getCurrentUser();
  const demo = isDemoMode();
  return (
    <main className="bg-aurora relative flex min-h-dvh flex-col overflow-hidden">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6 sm:px-8">
        <Link href="/" aria-label="HOP" className="flex items-center gap-3">
          <Logo height={30} />
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <Link href={homeFor(user.role)} className="btn btn-primary btn-sm">
              המשך לאפליקציה
              <ArrowLeft size={16} />
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-glass btn-sm">
                התחברות
              </Link>
              <Link href="/signup" className="btn btn-primary btn-sm">
                הרשמה
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:py-20">
        <div className="animate-fade-up">
          {demo && <DemoBanner className="mb-5" />}
          <h1 className="display text-[clamp(2.6rem,7vw,5.2rem)]">
            העיר שלך.
            <br />
            <span className="brand-gradient-text">הופ</span> אחד.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-fg-muted">
            HOP מחברת בין נוסעים לנהגים מורשים באפליקציה פשוטה, מהירה ושקופה. רואים את המחיר לפני ההזמנה, הנהג רואה בדיוק כמה הוא מקבל, והעמלה גלויה לכולם.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={user?.role === "rider" ? "/ride" : "/signup?role=rider"} className="btn btn-primary btn-lg">
              להזמין נסיעה
              <ArrowLeft size={18} />
            </Link>
            <Link href={user?.role === "driver" ? "/drive" : "/signup?role=driver"} className="btn btn-glass btn-lg">
              <Car size={18} />
              לנהוג עם HOP
            </Link>
          </div>
          <ul className="mt-10 grid max-w-xl gap-3 sm:grid-cols-3">
            {[
              { icon: <Wallet size={18} />, title: "מחיר לפני הזמנה", text: "חישוב בצד השרת, בלי הפתעות" },
              { icon: <ShieldCheck size={18} />, title: "נהגים מאומתים", text: "רישיונות ומסמכים נבדקים לפני נסיעה ראשונה" },
              { icon: <Sparkles size={18} />, title: "עמלה שקופה", text: "הנוסע, הנהג ו־HOP רואים את אותו פירוט" },
            ].map((f) => (
              <li key={f.title} className="glass glass-md p-4">
                <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl bg-brand-100 text-brand">{f.icon}</div>
                <div className="text-sm font-bold">{f.title}</div>
                <div className="text-xs text-fg-muted">{f.text}</div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-sm animate-fade-up [animation-delay:120ms]">
          <div className="absolute -inset-10 -z-10 rounded-full bg-brand/20 blur-3xl" aria-hidden />
          <div className="glass glass-strong overflow-hidden p-2">
            <div className="relative aspect-[9/16] overflow-hidden rounded-[24px] bg-[#e7e9ee]">
              <div
                className="absolute inset-0 opacity-40"
                style={{ backgroundImage: "linear-gradient(rgba(17,19,24,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(17,19,24,.12) 1px, transparent 1px)", backgroundSize: "36px 36px" }}
              />
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 640" fill="none" aria-hidden>
                <path d="M70 150 C 120 220, 150 260, 200 320 S 290 440, 300 520" stroke="#fff" strokeWidth="12" strokeLinecap="round" />
                <path d="M70 150 C 120 220, 150 260, 200 320 S 290 440, 300 520" stroke="#2457FF" strokeWidth="6" strokeLinecap="round" />
                <circle cx="70" cy="150" r="10" fill="#2457FF" stroke="#fff" strokeWidth="4" />
                <rect x="290" y="510" width="20" height="20" rx="5" fill="#111318" stroke="#fff" strokeWidth="4" />
              </svg>
              <div className="absolute inset-x-3 bottom-3 glass glass-strong p-4">
                <div className="eyebrow mb-1">לאן נוסעים?</div>
                <div className="flex items-center justify-between rounded-2xl bg-brand px-4 py-3 text-white">
                  <span className="font-bold">חיפוש יעד</span>
                  <ArrowLeft size={18} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-fg-muted">{"מונית · 12 דק'"}</span>
                  <span className="font-extrabold tabular-nums">₪42.30</span>
                </div>
              </div>
              <div className="absolute top-4 right-4">
                <LogoMark size={36} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {demo && !user && (
        <section className="mx-auto w-full max-w-6xl px-5 pb-12 sm:px-8">
          <div className="glass glass-md p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="eyebrow">חשבונות הדגמה</span>
              <DemoBanner compact text="סביבת פיתוח" />
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-4">
              {(["rider", "driver", "support", "admin"] as const).map((k) => (
                <div key={k} className="rounded-2xl border border-line bg-surface/60 p-3">
                  <div className="font-bold">{{ rider: "נוסע", driver: "נהג מאושר", support: "תמיכה", admin: "מנהל" }[k]}</div>
                  <div className="mt-1 text-right text-xs text-fg-muted">
                    <span dir="ltr" className="inline-block">{DEMO_ACCOUNTS[k].email}</span>
                  </div>
                  <div className="text-right text-xs text-fg-muted">
                    סיסמה: <span dir="ltr" className="inline-block font-mono">{DEMO_ACCOUNTS[k].password}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 pb-8 text-xs text-fg-muted sm:px-8">
        <span>© HOP · פיילוט. שירותים מסחריים יופעלו רק לאחר אישור רגולטורי וביטוחי.</span>
        <span className="flex gap-4">
          <Link href="/legal/terms" className="hover:text-fg">תנאי שימוש</Link>
          <Link href="/legal/privacy" className="hover:text-fg">מדיניות פרטיות</Link>
          <Link href="/login?next=/admin" className="hover:text-fg">מפעילים</Link>
        </span>
      </footer>
    </main>
  );
}
