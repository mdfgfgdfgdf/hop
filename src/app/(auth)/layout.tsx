import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-aurora flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-md px-5 pt-8">
        <Link href="/" aria-label="HOP">
          <Logo height={28} />
        </Link>
      </header>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-8">{children}</div>
    </main>
  );
}
