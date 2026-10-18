import { AuthBrandProvider } from "./AuthBrand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-liquid flex min-h-dvh flex-col overflow-clip">
      <AuthBrandProvider>{children}</AuthBrandProvider>
    </main>
  );
}
