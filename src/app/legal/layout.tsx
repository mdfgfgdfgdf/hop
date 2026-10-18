import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-aurora min-h-dvh">
      <header className="mx-auto w-full max-w-3xl px-5 pt-8">
        <Link href="/" aria-label="HOP">
          <Logo height={28} />
        </Link>
      </header>
      <article className="prose-hop mx-auto w-full max-w-3xl px-5 py-8 leading-relaxed [&_h1]:display [&_h1]:text-3xl [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_p]:mt-3 [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pr-5">
        {children}
      </article>
    </main>
  );
}
