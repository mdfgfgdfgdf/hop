import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "התחברות" };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
