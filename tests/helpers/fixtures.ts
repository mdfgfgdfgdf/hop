/**
 * Pure in-memory fixtures (no database) for unit tests of pricing, dispatch
 * ranking and serialization. Every factory returns a fully-typed row so the
 * unit tests exercise the same shapes the service layer produces.
 */
import type {
  DriverProfile,
  FareBreakdown,
  PricingConfig,
  Ride,
  RideOffer,
  ServiceType,
  User,
} from "@/server/db/schema";

const EPOCH = new Date("2026-01-01T00:00:00.000Z");
let seq = 0;
const nextId = (prefix: string) => `${prefix}-${++seq}`;

export function pricingConfig(overrides: Partial<PricingConfig> = {}): PricingConfig {
  return {
    id: "cfg-test",
    name: "test tariff",
    active: true,
    isDemo: true,
    currency: "ILS",
    baseFareAgorot: 1000,
    perKmAgorot: 500,
    perMinuteAgorot: 100,
    bookingFeeAgorot: 200,
    minFareAgorot: 2500,
    maxFareAgorot: 80000,
    commissionPercentBp: 1500,
    commissionFixedAgorot: 0,
    cancellationFeeAgorot: 1500,
    freeCancelWindowSec: 120,
    nightMultiplierBp: 12500,
    nightStart: "21:00",
    nightEnd: "05:30",
    roundingAgorot: 10,
    quoteTtlSec: 300,
    notes: null,
    updatedBy: null,
    createdAt: EPOCH,
    updatedAt: EPOCH,
    ...overrides,
  };
}

export function user(overrides: Partial<User> = {}): User {
  const id = overrides.id ?? nextId("user");
  return {
    id,
    role: "rider",
    status: "active",
    name: `User ${id}`,
    email: `${id}@test.local`,
    phone: "050-123-4567",
    passwordHash: "x",
    locale: "he",
    isDemo: false,
    suspendedReason: null,
    createdAt: EPOCH,
    updatedAt: EPOCH,
    ...overrides,
  };
}

export function driverProfile(overrides: Partial<DriverProfile> = {}): DriverProfile {
  return {
    userId: overrides.userId ?? nextId("driver"),
    verificationStatus: "approved",
    availability: "online",
    serviceTypeIds: ["taxi"],
    vehicleClass: "standard",
    vehicleMake: "Toyota",
    vehicleModel: "Corolla",
    vehicleColor: "white",
    vehiclePlate: "12-345-67",
    vehicleYear: 2022,
    seats: 4,
    licenseNumber: null,
    taxiLicenseNumber: null,
    lastLat: 32.0752,
    lastLng: 34.7751,
    lastHeading: 90,
    lastLocationAt: EPOCH,
    offersReceived: 0,
    offersAccepted: 0,
    ratingSum: 0,
    ratingCount: 0,
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    rejectionReason: null,
    createdAt: EPOCH,
    updatedAt: EPOCH,
    ...overrides,
  };
}

/** A driver candidate as consumed by `rankCandidates`. */
export function candidate(at: { lat: number; lng: number }, overrides: { user?: Partial<User>; profile?: Partial<DriverProfile> } = {}) {
  const u = user({ role: "driver", ...overrides.user });
  const p = driverProfile({ userId: u.id, lastLat: at.lat, lastLng: at.lng, ...overrides.profile });
  return { user: u, profile: p };
}

export function serviceType(overrides: Partial<ServiceType> = {}): ServiceType {
  return {
    id: "taxi",
    nameHe: "מונית",
    descriptionHe: "מונית מורשית",
    enabled: true,
    legalStatus: "approved",
    vehicleClasses: ["standard", "xl", "premium", "accessible"],
    priceMultiplierBp: 10000,
    seats: 4,
    sortOrder: 1,
    updatedAt: EPOCH,
    ...overrides,
  };
}

export function fare(overrides: Partial<FareBreakdown> = {}): FareBreakdown {
  return {
    currency: "ILS",
    riderTotalAgorot: 3000,
    hopCommissionAgorot: 560,
    driverPayoutAgorot: 2440,
    lines: [],
    commissionPercentBp: 1200,
    commissionFixedAgorot: 0,
    bookingFeeAgorot: 200,
    discountAgorot: 0,
    nightSurchargeApplied: false,
    serviceMultiplierBp: 10000,
    isDemoTariff: true,
    pricingConfigId: "cfg-test",
    ...overrides,
  };
}

export function ride(overrides: Partial<Ride> = {}): Ride {
  return {
    id: overrides.id ?? nextId("ride"),
    riderId: "rider-1",
    driverId: null,
    quoteId: null,
    serviceTypeId: "taxi",
    status: "searching",
    pickupLat: 32.0752,
    pickupLng: 34.7751,
    pickupAddress: "דיזנגוף סנטר",
    dropoffLat: 32.0807,
    dropoffLng: 34.7805,
    dropoffAddress: "כיכר רבין",
    traffic: null,
    pickupPin: null,
    tipAgorot: 0,
    polyline: [
      [32.0752, 34.7751],
      [32.0807, 34.7805],
    ],
    estimatedDistanceM: 2000,
    estimatedDurationS: 600,
    actualDistanceM: null,
    actualDurationS: null,
    quotedFare: fare(),
    finalFare: null,
    quotedTotalAgorot: 3000,
    finalTotalAgorot: null,
    commissionAgorot: null,
    driverPayoutAgorot: null,
    cancellationFeeAgorot: 0,
    refundedAgorot: 0,
    paymentMethod: "cash",
    paymentStatus: "pending",
    offeredDriverId: null,
    offerExpiresAt: null,
    offerAttempts: 0,
    excludedDriverIds: [],
    searchExpiresAt: null,
    requestedAt: EPOCH,
    acceptedAt: null,
    arrivingAt: null,
    arrivedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    riderRating: null,
    driverRating: null,
    flags: [],
    adminNotes: null,
    isDemo: false,
    version: 1,
    createdAt: EPOCH,
    updatedAt: EPOCH,
    ...overrides,
  };
}

export function offer(overrides: Partial<RideOffer> = {}): RideOffer {
  return {
    id: overrides.id ?? nextId("offer"),
    rideId: "ride-x",
    driverId: "driver-x",
    status: "pending",
    attempt: 1,
    driverDistanceM: 800,
    driverEtaS: 180,
    driverPayoutAgorot: 2440,
    expiresAt: new Date("2026-01-01T00:00:20.000Z"),
    respondedAt: null,
    createdAt: EPOCH,
    ...overrides,
  };
}

/** Well-known coordinates (same as `TLV` in ./db, without importing the DB layer). */
export const PLACES = {
  dizengoff: { lat: 32.0752, lng: 34.7751, address: "דיזנגוף סנטר, תל אביב" },
  rabin: { lat: 32.0807, lng: 34.7805, address: "כיכר רבין, תל אביב" },
  airport: { lat: 32.0004, lng: 34.8706, address: "נתב\"ג" },
  jerusalem: { lat: 31.7892, lng: 35.2031, address: "ירושלים" },
};
