import { Suspense } from "react";
import type { Metadata } from "next";
import { UsersList } from "@/components/admin/screens/Users";
import { ListFallback } from "@/components/admin/fallbacks";

export const metadata: Metadata = { title: "משתמשים · מרכז בקרה" };

export default function UsersPage() {
  return (
    <Suspense fallback={<ListFallback title="משתמשים" />}>
      <UsersList />
    </Suspense>
  );
}
