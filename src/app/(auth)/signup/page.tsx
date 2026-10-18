import { Suspense } from "react";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "הרשמה" };

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
