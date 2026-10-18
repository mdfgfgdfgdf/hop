"use client";
import { createContext, useContext } from "react";
import { useSession } from "@/components/app/session";

type RiderInfo = { demoMode: boolean; initialName: string | null };
export const RiderInfoContext = createContext<RiderInfo>({ demoMode: false, initialName: null });

export function useRiderInfo() {
  const info = useContext(RiderInfoContext);
  const { user } = useSession();
  const name = user?.name ?? info.initialName ?? "";
  return { demoMode: info.demoMode, name, firstName: name.split(/\s+/)[0] ?? "" };
}
