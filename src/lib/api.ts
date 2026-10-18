/**
 * Typed client for the HOP API. Client-safe (no server imports).
 * Every call returns parsed JSON or throws ApiClientError { code, message }.
 */
import type {
  DriverDocumentDTO,
  DriverProfileDTO,
  EarningsDTO,
  PlaceDTO,
  PublicUserDTO,
  QuoteResponse,
  RideDTO,
  RideEventDTO,
  ServiceTypeDTO,
} from "./types";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function apiFetch<T>(path: string, opts: { method?: Method; body?: unknown; form?: FormData; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(path, { method: opts.method ?? (body ? "POST" : "GET"), headers, body, credentials: "same-origin", signal: opts.signal, cache: "no-store" });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiClientError(0, "network", "אין חיבור לשרת. בדקו את החיבור לאינטרנט.");
  }
  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiClientError(res.status, e?.code ?? "http_error", e?.message ?? `שגיאה (${res.status})`, e?.details);
  }
  return json as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export type MeResponse = { user: PublicUserDTO | null; driverProfile: DriverProfileDTO | null; demoMode: boolean };

export const api = {
  auth: {
    me: () => apiFetch<MeResponse>("/api/auth/me"),
    signup: (input: { role: "rider" | "driver"; name: string; email: string; phone: string; password: string; acceptTerms: true }) =>
      apiFetch<{ user: PublicUserDTO }>("/api/auth/signup", { method: "POST", body: input }),
    login: (input: { email: string; password: string }) => apiFetch<{ user: PublicUserDTO }>("/api/auth/login", { method: "POST", body: input }),
    logout: () => apiFetch<{ ok: true }>("/api/auth/logout", { method: "POST" }),
    updateProfile: (input: { name?: string; phone?: string; locale?: "he" | "en" }) => apiFetch<{ user: PublicUserDTO }>("/api/auth/me", { method: "PATCH", body: input }),
  },
  geo: {
    search: (q: string, near?: { lat: number; lng: number } | null, signal?: AbortSignal) => {
      const p = new URLSearchParams({ q });
      if (near) {
        p.set("lat", String(near.lat));
        p.set("lng", String(near.lng));
      }
      return apiFetch<{ places: PlaceDTO[]; provider: "demo" | "osm" }>(`/api/geo/search?${p}`, { signal });
    },
    reverse: (lat: number, lng: number, signal?: AbortSignal) =>
      apiFetch<{ place: PlaceDTO | null; provider: "demo" | "osm" }>(`/api/geo/reverse?lat=${lat}&lng=${lng}`, { signal }),
  },
  serviceTypes: () => apiFetch<{ serviceTypes: ServiceTypeDTO[] }>("/api/service-types"),
  quotes: {
    create: (input: { pickup: { lat: number; lng: number; address: string; name?: string; id?: string; provider?: "demo" | "osm" }; dropoff: { lat: number; lng: number; address: string; name?: string; id?: string; provider?: "demo" | "osm" }; promoCode?: string | null }) =>
      apiFetch<QuoteResponse>("/api/quotes", { method: "POST", body: input }),
  },
  rides: {
    create: (input: { quoteId: string; paymentMethod: "cash" | "card_demo" }) => apiFetch<{ ride: RideDTO }>("/api/rides", { method: "POST", body: input }),
    list: (opts: { limit?: number; offset?: number } = {}) => apiFetch<{ rides: RideDTO[] }>(`/api/rides?limit=${opts.limit ?? 30}&offset=${opts.offset ?? 0}`),
    active: () => apiFetch<{ ride: RideDTO | null }>("/api/rides/active"),
    get: (id: string) => apiFetch<{ ride: RideDTO }>(`/api/rides/${id}`),
    events: (id: string) => apiFetch<{ events: RideEventDTO[] }>(`/api/rides/${id}/events`),
    cancel: (id: string, reason?: string | null) => apiFetch<{ ride: RideDTO }>(`/api/rides/${id}/cancel`, { method: "POST", body: { reason: reason ?? null } }),
    rate: (id: string, stars: number, comment?: string | null) => apiFetch<{ ride: RideDTO }>(`/api/rides/${id}/rate`, { method: "POST", body: { stars, comment: comment ?? null } }),
  },
  driver: {
    profile: () => apiFetch<{ profile: DriverProfileDTO; documents: DriverDocumentDTO[]; requiredDocuments: string[] }>("/api/driver/profile"),
    updateProfile: (input: Partial<Pick<DriverProfileDTO, "vehicleClass" | "vehicleMake" | "vehicleModel" | "vehicleColor" | "vehiclePlate" | "vehicleYear" | "seats" | "licenseNumber" | "taxiLicenseNumber" | "serviceTypeIds">>) =>
      apiFetch<{ profile: DriverProfileDTO }>("/api/driver/profile", { method: "PATCH", body: input }),
    documents: () => apiFetch<{ documents: DriverDocumentDTO[]; requiredDocuments: string[]; labels: Record<string, string> }>("/api/driver/documents"),
    uploadDocument: (type: string, file: File, expiresAt?: string | null) => {
      const form = new FormData();
      form.set("type", type);
      form.set("file", file);
      if (expiresAt) form.set("expiresAt", expiresAt);
      return apiFetch<{ document: DriverDocumentDTO }>("/api/driver/documents", { method: "POST", form });
    },
    documentUrl: (id: string) => `/api/driver/documents/${id}`,
    setAvailability: (online: boolean, location?: { lat: number; lng: number } | null) =>
      apiFetch<{ profile: DriverProfileDTO }>("/api/driver/availability", { method: "POST", body: { online, location: location ?? null } }),
    location: (input: { lat: number; lng: number; heading?: number | null; speedMps?: number | null }) => apiFetch<{ ok: true }>("/api/driver/location", { method: "POST", body: input }),
    acceptOffer: (rideId: string) => apiFetch<{ ride: RideDTO }>(`/api/driver/offers/${rideId}/accept`, { method: "POST" }),
    declineOffer: (rideId: string) => apiFetch<{ ride: RideDTO }>(`/api/driver/offers/${rideId}/decline`, { method: "POST" }),
    arriving: (rideId: string) => apiFetch<{ ride: RideDTO }>(`/api/driver/rides/${rideId}/arriving`, { method: "POST" }),
    arrived: (rideId: string) => apiFetch<{ ride: RideDTO }>(`/api/driver/rides/${rideId}/arrived`, { method: "POST" }),
    start: (rideId: string) => apiFetch<{ ride: RideDTO }>(`/api/driver/rides/${rideId}/start`, { method: "POST" }),
    complete: (rideId: string) => apiFetch<{ ride: RideDTO }>(`/api/driver/rides/${rideId}/complete`, { method: "POST" }),
    earnings: (range: "today" | "week" | "month" | "all" = "week") => apiFetch<{ earnings: EarningsDTO }>(`/api/driver/earnings?range=${range}`),
  },
  support: {
    create: (input: { rideId?: string | null; category: "complaint" | "safety" | "lost_item" | "payment" | "incident" | "other"; subject: string; body: string }) =>
      apiFetch<{ ticket: TicketDTO }>("/api/support/tickets", { method: "POST", body: input }),
    list: (status?: TicketDTO["status"]) => apiFetch<{ tickets: TicketDTO[] }>(`/api/support/tickets${status ? `?status=${status}` : ""}`),
    get: (id: string) => apiFetch<{ ticket: TicketDTO }>(`/api/support/tickets/${id}`),
    message: (id: string, body: string, internal = false) => apiFetch<{ ticket: TicketDTO }>(`/api/support/tickets/${id}/messages`, { method: "POST", body: { body, internal } }),
  },
  admin: {
    overview: () => apiFetch<AdminOverview>("/api/admin/overview"),
    drivers: (q: { status?: string; q?: string; limit?: number } = {}) => apiFetch<{ drivers: { user: PublicUserDTO; profile: DriverProfileDTO }[] }>(`/api/admin/drivers?${toQuery(q)}`),
    driver: (id: string) => apiFetch<AdminDriverDetail>(`/api/admin/drivers/${id}`),
    verifyDriver: (id: string, input: { decision: "approve" | "reject" | "suspend" | "reinstate"; reason?: string | null; notes?: string | null }) =>
      apiFetch<{ profile: DriverProfileDTO }>(`/api/admin/drivers/${id}/verify`, { method: "POST", body: input }),
    reviewDocument: (driverId: string, docId: string, input: { status: "approved" | "rejected"; notes?: string | null }) =>
      apiFetch<{ document: DriverDocumentDTO }>(`/api/admin/drivers/${driverId}/documents/${docId}`, { method: "POST", body: input }),
    users: (q: { role?: string; status?: string; q?: string; limit?: number } = {}) => apiFetch<{ users: PublicUserDTO[] }>(`/api/admin/users?${toQuery(q)}`),
    user: (id: string) => apiFetch<AdminUserDetail>(`/api/admin/users/${id}`),
    updateUser: (id: string, input: { status?: "active" | "suspended"; reason?: string | null; role?: "rider" | "driver" | "admin" | "support" }) =>
      apiFetch<{ user: PublicUserDTO }>(`/api/admin/users/${id}`, { method: "PATCH", body: input }),
    rides: (q: { status?: string; flagged?: boolean; q?: string; from?: string; to?: string; limit?: number } = {}) =>
      apiFetch<{ rides: RideDTO[] }>(`/api/admin/rides?${toQuery({ ...q, flagged: q.flagged ? "true" : undefined })}`),
    ride: (id: string) => apiFetch<AdminRideDetail>(`/api/admin/rides/${id}`),
    cancelRide: (id: string, reason: string) => apiFetch<{ ride: RideDTO }>(`/api/admin/rides/${id}/cancel`, { method: "POST", body: { reason } }),
    adjustRide: (id: string, input: { refundAgorot?: number; note: string }) => apiFetch<{ ride: RideDTO }>(`/api/admin/rides/${id}/adjust`, { method: "POST", body: input }),
    pricing: () => apiFetch<{ active: PricingConfigDTO | null; history: PricingConfigDTO[] }>("/api/admin/pricing"),
    updatePricing: (input: Partial<PricingConfigDTO>) => apiFetch<{ active: PricingConfigDTO }>("/api/admin/pricing", { method: "PUT", body: input }),
    serviceTypes: () => apiFetch<{ serviceTypes: ServiceTypeDTO[] }>("/api/admin/service-types"),
    updateServiceType: (id: string, input: Partial<Pick<ServiceTypeDTO, "enabled" | "nameHe" | "descriptionHe" | "priceMultiplierBp" | "vehicleClasses" | "seats" | "sortOrder" | "legalStatus">>) =>
      apiFetch<{ serviceType: ServiceTypeDTO }>(`/api/admin/service-types/${id}`, { method: "PATCH", body: input }),
    reports: (q: { from?: string; to?: string } = {}) => apiFetch<AdminReport>(`/api/admin/reports?${toQuery(q)}`),
    audit: (q: { action?: string; actorId?: string; limit?: number } = {}) => apiFetch<{ logs: AuditLogDTO[] }>(`/api/admin/audit?${toQuery(q)}`),
    settings: () => apiFetch<{ settings: Record<string, unknown>; defaults: Record<string, unknown> }>("/api/admin/settings"),
    updateSettings: (input: Record<string, number | boolean | string>) => apiFetch<{ settings: Record<string, unknown> }>("/api/admin/settings", { method: "PUT", body: input }),
    tickets: (q: { status?: string; limit?: number } = {}) => apiFetch<{ tickets: TicketDTO[] }>(`/api/admin/tickets?${toQuery(q)}`),
    ticket: (id: string) => apiFetch<{ ticket: TicketDTO }>(`/api/admin/tickets/${id}`),
    updateTicket: (id: string, input: { status?: TicketDTO["status"]; priority?: TicketDTO["priority"]; assignedTo?: string | null }) =>
      apiFetch<{ ticket: TicketDTO }>(`/api/admin/tickets/${id}`, { method: "PATCH", body: input }),
  },
  demo: {
    tick: () => apiFetch<{ ok: true }>("/api/demo/simulate", { method: "POST" }),
  },
};

function toQuery(obj: Record<string, string | number | boolean | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== "" && v !== false) p.set(k, String(v));
  return p.toString();
}

// ───────────────────────────── admin / support DTOs ─────────────────────────────

export type TicketDTO = {
  id: string;
  rideId: string | null;
  openedBy: string;
  openerName: string | null;
  category: "complaint" | "safety" | "lost_item" | "payment" | "incident" | "other";
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  subject: string;
  body: string;
  assignedTo: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: { id: string; authorId: string; body: string; internal: boolean; createdAt: string }[];
};

export type PricingConfigDTO = {
  id: string;
  name: string;
  active: boolean;
  isDemo: boolean;
  currency: string;
  baseFareAgorot: number;
  perKmAgorot: number;
  perMinuteAgorot: number;
  bookingFeeAgorot: number;
  minFareAgorot: number;
  maxFareAgorot: number;
  commissionPercentBp: number;
  commissionFixedAgorot: number;
  cancellationFeeAgorot: number;
  freeCancelWindowSec: number;
  nightMultiplierBp: number;
  nightStart: string;
  nightEnd: string;
  roundingAgorot: number;
  quoteTtlSec: number;
  notes: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminOverview = {
  activeRides: number;
  completedToday: number;
  cancelledToday: number;
  grossTodayAgorot: number;
  commissionTodayAgorot: number;
  payoutTodayAgorot: number;
  onlineDrivers: number;
  pendingVerifications: number;
  openTickets: number;
  flaggedRides: number;
  totalUsers: number;
  recentRides: RideDTO[];
  liveDrivers: { id: string; name: string; availability: "offline" | "online" | "busy"; lat: number | null; lng: number | null; heading: number | null; vehicleClass: string; at: string | null }[];
};

export type AdminDriverDetail = {
  user: PublicUserDTO;
  profile: DriverProfileDTO;
  documents: DriverDocumentDTO[];
  stats: { completedRides: number; payoutAgorot: number };
  recentRides: RideDTO[];
};

export type AdminUserDetail = {
  user: PublicUserDTO;
  suspendedReason: string | null;
  stats: { rides: number };
  recentRides: RideDTO[];
  driverProfile: DriverProfileDTO | null;
};

export type AdminRideDetail = {
  ride: RideDTO;
  events: RideEventDTO[];
  offers: { id: string; driverId: string; status: string; attempt: number; driverDistanceM: number; driverEtaS: number; driverPayoutAgorot: number; expiresAt: string; respondedAt: string | null; createdAt: string }[];
  ledger: { id: string; type: string; amountAgorot: number; note: string | null; userId: string | null; createdAt: string }[];
  track: { lat: number; lng: number; at: string }[];
};

export type AdminReport = {
  from: string;
  to: string;
  isDemoTariff: boolean;
  totals: { rides: number; gross: number; commission: number; payout: number; distanceM: number; cancelled: number; cancellationFeesAgorot: number; refundsAgorot: number; netCommissionAgorot: number };
  byDay: { day: string; rides: number; grossAgorot: number; commissionAgorot: number; payoutAgorot: number; distanceM: number }[];
  byService: { serviceTypeId: string; rides: number; grossAgorot: number }[];
  ledger: { type: string; totalAgorot: number; entries: number }[];
};

export type AuditLogDTO = {
  id: string;
  actorId: string | null;
  actorRole: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  data: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
};
