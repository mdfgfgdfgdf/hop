import { getCurrentUser } from "@/server/auth/session";
import { homeFor } from "@/server/auth/redirects";
import { isDemoMode } from "@/server/env";
import { getLandingData } from "./_landing/example-fare";
import { LandingHeader } from "./_landing/LandingHeader";
import { Closing, DemoAccounts, Drivers, Faq, Hero, LandingFooter, Price, RideOptions, Safety } from "./_landing/Sections";
import "./_landing/landing.css";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getLandingData()]);
  const demo = isDemoMode();
  const appHref = user ? homeFor(user.role) : null;
  const rideHref = user?.role === "rider" ? "/ride" : "/signup?role=rider";
  const driveHref = user?.role === "driver" ? "/drive" : "/signup?role=driver";
  const city = data.trips.find((t) => t.id === "city") ?? data.trips[0];

  return (
    <div className="lp">
      {/* Without JS, scroll-in reveals must not leave content invisible. */}
      <noscript>
        <style>{".lp-reveal{opacity:1!important;transform:none!important}"}</style>
      </noscript>
      <LandingHeader appHref={appHref} />
      <main>
        <Hero demo={demo} rideHref={rideHref} driveHref={driveHref} signedIn={!!user} examplePrice={city.riderTotal} />
        <RideOptions data={data} rideHref={rideHref} signedIn={!!user} />
        <Safety />
        <Price data={data} />
        <Drivers data={data} driveHref={driveHref} signedIn={!!user} />
        <Faq data={data} demo={demo} />
        <Closing appHref={appHref} driveHref={driveHref} />
        {demo && !user && <DemoAccounts />}
      </main>
      <LandingFooter demo={demo} />
    </div>
  );
}
