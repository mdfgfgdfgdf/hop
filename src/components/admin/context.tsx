"use client";
/**
 * Operator context: who is looking at the dashboard and what they may do.
 * The API enforces permissions (403); this only drives what the UI offers.
 */
import { createContext, useContext } from "react";

export type StaffRole = "admin" | "support";

type AdminContextValue = {
  role: StaffRole;
  isAdmin: boolean;
  name: string;
  demoMode: boolean;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ role, name, demoMode, children }: { role: StaffRole; name: string; demoMode: boolean; children: React.ReactNode }) {
  return <AdminContext.Provider value={{ role, isAdmin: role === "admin", name, demoMode }}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside AdminShell");
  return ctx;
}
