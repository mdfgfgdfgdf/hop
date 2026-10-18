/**
 * Shared DTO types (server → client). Keep in sync with
 * src/server/dispatch/serialize.ts. These are plain JSON-safe objects.
 */
import type {
  FareBreakdown,
  Polyline,
  RideFlag,
  RideStatus,
  UserRole,
  VerificationStatus,
  DriverAvailability,
  VehicleClass,
  DocumentType,
} from "@/server/db/schema";

export type { FareBreakdown, Polyline, RideFlag, RideStatus, UserRole, VerificationStatus, DriverAvailability, VehicleClass, DocumentType };

export type LatLng = { lat: number; lng: number };

export type PublicUserDTO = {
  id: string;
  role: UserRole;
  status: "active" | "suspended";
  name: string;
  email: string;
  phone: string | null;
  locale: string;
  isDemo: boolean;
  createdAt: string;
};

export type PlaceDTO = {
  id: string;
  name: string;
  address: string;
  city?: string;
  lat: number;
  lng: number;
  kind?: "poi" | "address" | "transit" | "city";
  provider: "demo" | "osm";
};

export type ServiceTypeDTO = {
  id: string;
  nameHe: string;
  descriptionHe: string;
  enabled: boolean;
  legalStatus: "approved" | "requires_regulatory_approval";
  vehicleClasses: string[];
  priceMultiplierBp: number;
  seats: number;
  sortOrder: number;
};

export type RouteDTO = {
  distanceM: number;
  durationS: number;
  polyline: Polyline;
  provider: "demo" | "osm";
};

export type QuoteDTO = {
  id: string;
  serviceType: ServiceTypeDTO;
  fare: FareBreakdown;
  riderTotalAgorot: number;
  expiresAt: string;
  etaToPickupS: number | null; // nearest available driver, null if none
  availableDrivers: number;
};

export type CancellationPolicyDTO = {
  freeCancelWindowSec: number; // after a driver accepts
  feeAgorot: number;
};

export type QuoteResponse = {
  route: RouteDTO;
  pickup: PlaceDTO;
  dropoff: PlaceDTO;
  quotes: QuoteDTO[];
  geoProvider: "demo" | "osm";
  isDemoTariff: boolean;
  cancellationPolicy: CancellationPolicyDTO;
};

export type RideCounterpartDTO = {
  id: string;
  name: string;
  phoneMasked: string | null;
  rating: number | null;
  ratingCount: number;
  vehicle?: {
    make: string | null;
    model: string | null;
    color: string | null;
    plate: string | null;
    class: VehicleClass;
  };
  location?: { lat: number; lng: number; heading: number | null; at: string } | null;
};

export type RideDTO = {
  id: string;
  status: RideStatus;
  serviceType: ServiceTypeDTO;
  pickup: { lat: number; lng: number; address: string };
  dropoff: { lat: number; lng: number; address: string };
  polyline: Polyline;
  estimatedDistanceM: number;
  estimatedDurationS: number;
  actualDistanceM: number | null;
  actualDurationS: number | null;
  quotedFare: FareBreakdown;
  finalFare: FareBreakdown | null;
  quotedTotalAgorot: number;
  finalTotalAgorot: number | null;
  commissionAgorot: number | null;
  driverPayoutAgorot: number | null;
  cancellationFeeAgorot: number;
  refundedAgorot: number;
  paymentMethod: "cash" | "card_demo";
  paymentStatus: "not_applicable" | "pending" | "paid" | "refunded" | "partially_refunded";
  offerExpiresAt: string | null;
  offerAttempts: number;
  requestedAt: string;
  acceptedAt: string | null;
  arrivingAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: "rider" | "driver" | "system" | "admin" | null;
  cancelReason: string | null;
  riderRating: number | null;
  driverRating: number | null;
  flags: RideFlag[];
  isDemo: boolean;
  rider: RideCounterpartDTO | null;
  driver: RideCounterpartDTO | null;
  /** For the driver app: estimated pickup distance/ETA for the current offer. */
  offer?: {
    id: string;
    driverDistanceM: number;
    driverEtaS: number;
    driverPayoutAgorot: number;
    expiresAt: string;
  } | null;
  adminNotes?: string | null;
};

export type RideEventDTO = {
  id: string;
  type: string;
  actorRole: string | null;
  data: Record<string, unknown>;
  createdAt: string;
};

export type DriverProfileDTO = {
  userId: string;
  verificationStatus: VerificationStatus;
  availability: DriverAvailability;
  serviceTypeIds: string[];
  vehicleClass: VehicleClass;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehiclePlate: string | null;
  vehicleYear: number | null;
  seats: number;
  licenseNumber: string | null;
  taxiLicenseNumber: string | null;
  lastLocation: { lat: number; lng: number; heading: number | null; at: string } | null;
  offersReceived: number;
  offersAccepted: number;
  rating: number | null;
  ratingCount: number;
  rejectionReason: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type DriverDocumentDTO = {
  id: string;
  type: DocumentType;
  status: "submitted" | "approved" | "rejected";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  expiresAt: string | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  uploadedAt: string;
};

export type EarningsDTO = {
  from: string;
  to: string;
  ridesCompleted: number;
  grossAgorot: number; // what riders paid for the driver's rides
  commissionAgorot: number; // HOP commission on those rides
  netAgorot: number; // driver payout
  cancellationFeesAgorot: number;
  byDay: { date: string; rides: number; netAgorot: number; grossAgorot: number }[];
  isDemoTariff: boolean;
};

export type SseEvent = {
  id: string;
  type:
    | "ride.updated"
    | "ride.offer"
    | "ride.offer.cancelled"
    | "driver.location"
    | "driver.availability"
    | "admin.ride"
    | "admin.driver"
    | "notification"
    | "ping";
  at: string;
  data: unknown;
};

export type ApiError = { error: { code: string; message: string; details?: unknown } };
