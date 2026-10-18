import { AuthBrandProvider } from "./AuthBrand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-white">
      <AuthBrandProvider>{children}</AuthBrandProvider>
    </main>
  );
}
