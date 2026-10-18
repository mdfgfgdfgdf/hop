import Link from "next/link";
import { ArrowLeft, Car, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { AnimatedLogo, AnimatedMark } from "@/components/brand/AnimatedLogo";
import { getCurrentUser } from "@/server/auth/session";
import { homeFor } from "@/server/auth/redirects";
import { isDemoMode } from "@/server/env";
import { DEMO_ACCOUNTS } from "@/server/db/seed";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { PhoneMock } from "./_landing/PhoneMock";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: Wallet, title: "מחיר לפני הזמנה", text: "המחיר מחושב בצד השרת ומוצג לפני שמזמינים. בלי הפתעות בסוף הנסיעה." },
  { icon: ShieldCheck, title: "נהגים מאומתים", text: "רישיונות, היתרים וביטוח נבדקים לפני הנסיעה הראשונה של כל נהג." },
  { icon: Sparkles, title: "עמלה שקופה", text: "הנוסע, הנהג ו־HOP רואים את אותו פירוט: כמה מקבל הנהג וכמה העמלה." },
] as const;

const ROLE_HE = { rider: "נוסע", driver: "נהג מאושר", support: "תמיכה", admin: "מנהל" } as const;

export default async function LandingPage() {
  const user = await getCurrentUser();
  const demo = isDemoMode();
  return (
    <main className="bg-liquid flex min-h-dvh flex-col overflow-clip">
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-6 sm:pt-4">
        <div className="glass glass-strong glass-pill mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 ps-2 pe-2.5">
          <Link href="/" aria-label="HOP — דף הבית" className="flex items-center gap-3 rounded-full">
            <AnimatedMark size={44} hopOn="hover" title="HOP" />
            <span className="hidden text-[11px] font-extrabold tracking-[0.28em] text-fg-muted sm:inline" dir="ltr">
              MOVE WITH HOP
            </span>
          </Link>
          <nav className="flex items-center gap-2" aria-label="חשבון">
            {user ? (
              <Link href={homeFor(user.role)} className="btn btn-primary btn-sm">
                המשך לאפליקציה
                <ArrowLeft size={16} aria-hidden />
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
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-5 pt-10 pb-14 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-8 lg:pt-16 lg:pb-20">
        <div className="animate-fade-up">
          {demo && <DemoBanner className="mb-6" />}
          <AnimatedLogo hopOn="both" height={150} title="HOP" className="h-auto! w-[min(62vw,300px)]! lg:w-[340px]!" />
          <h1 className="display mt-7 text-[clamp(2rem,5.4vw,3.4rem)]">
            <span className="sr-only">HOP — </span>
            העיר שלך. <span className="brand-gradient-text">הופ</span> אחד.
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-fg-muted sm:text-lg">
            HOP מחברת בין נוסעים לנהגים מורשים באפליקציה פשוטה, מהירה ושקופה. רואים את המחיר לפני ההזמנה, הנהג רואה בדיוק כמה הוא מקבל, והעמלה גלויה לכולם.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href={user?.role === "rider" ? "/ride" : "/signup?role=rider"} className="btn btn-primary btn-lg">
              להזמין נסיעה
              <ArrowLeft size={18} aria-hidden />
            </Link>
            <Link href={user?.role === "driver" ? "/drive" : "/signup?role=driver"} className="btn btn-glass btn-lg">
              <Car size={18} aria-hidden />
              לנהוג עם HOP
            </Link>
          </div>
          <p className="mt-5 text-sm font-semibold text-fg-muted">פיילוט בתל אביב–יפו · נוסעים, נהגים ומפעילים באותו פירוט מחיר</p>
        </div>

        <div className="animate-fade-up [animation-delay:140ms]">
          <PhoneMock />
        </div>
      </section>

      <section aria-labelledby="why-hop" className="mx-auto w-full max-w-6xl px-5 pb-14 sm:px-8">
        <h2 id="why-hop" className="eyebrow mb-4 px-1">
          למה HOP
        </h2>
        <ul className="grid gap-3 sm:gap-4 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="glass glass-md p-5 sm:p-6">
              <span className="glass glass-brand glass-sm mb-4 grid h-11 w-11 place-items-center">
                <Icon size={20} aria-hidden />
              </span>
              <div className="text-[17px] font-extrabold">{title}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      {demo && !user && (
        <section aria-labelledby="demo-accounts" className="mx-auto w-full max-w-6xl px-5 pb-12 sm:px-8">
          <div className="glass glass-strong glass-md p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 id="demo-accounts" className="eyebrow">
                חשבונות הדגמה
              </h2>
              <DemoBanner compact text="סביבת פיתוח" />
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {(["rider", "driver", "support", "admin"] as const).map((k) => (
                <div key={k} className="rounded-[18px] border border-line bg-surface/80 p-3.5 shadow-[0_1px_2px_rgba(17,19,24,.04)]">
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
        </section>
      )}

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 pb-8 text-xs text-fg-muted sm:px-8">
        <span>© HOP · פיילוט. שירותים מסחריים יופעלו רק לאחר אישור רגולטורי וביטוחי.</span>
        <span className="flex gap-4">
          <Link href="/legal/terms" className="hover:text-fg">
            תנאי שימוש
          </Link>
          <Link href="/legal/privacy" className="hover:text-fg">
            מדיניות פרטיות
          </Link>
          <Link href="/login?next=/admin" className="hover:text-fg">
            מפעילים
          </Link>
        </span>
      </footer>
    </main>
  );
}
