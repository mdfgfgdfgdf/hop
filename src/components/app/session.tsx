"use client";
/**
 * Client session context. Hydrated lazily from /api/auth/me; server layouts
 * already enforce access, this is for UI state (name, role, driver profile).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type MeResponse } from "@/lib/api";

type SessionState = MeResponse & { loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void> };

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children, initial }: { children: React.ReactNode; initial?: MeResponse }) {
  const router = useRouter();
  const [state, setState] = useState<MeResponse>(initial ?? { user: null, driverProfile: null, demoMode: false });
  const [loading, setLoading] = useState(!initial);

  const refresh = useCallback(async () => {
    try {
      const me = await api.auth.me();
      setState(me);
    } catch {
      /* keep previous */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initial) return;
    let active = true;
    api.auth
      .me()
      .then((me) => {
        if (active) setState(me);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initial]);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setState({ user: null, driverProfile: null, demoMode: state.demoMode });
    router.replace("/");
    router.refresh();
  }, [state.demoMode, router]);

  const value = useMemo(() => ({ ...state, loading, refresh, logout }), [state, loading, refresh, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
