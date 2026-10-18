import type {
  DriverDocument,
  DriverProfile,
  Ride,
  RideEvent,
  RideOffer,
  ServiceType,
  User,
} from "../db/schema";
import type {
  DriverDocumentDTO,
  DriverProfileDTO,
  RideCounterpartDTO,
  RideDTO,
  RideEventDTO,
  ServiceTypeDTO,
} from "@/lib/types";

export type Viewer = { id: string; role: User["role"] };

export function serializeServiceType(s: ServiceType): ServiceTypeDTO {
  return {
    id: s.id,
    nameHe: s.nameHe,
    descriptionHe: s.descriptionHe,
    enabled: s.enabled,
    legalStatus: s.legalStatus,
    vehicleClasses: s.vehicleClasses,
    priceMultiplierBp: s.priceMultiplierBp,
    seats: s.seats,
    sortOrder: s.sortOrder,
  };
}

export function maskPhone(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "•••";
  return `•••-${digits.slice(-4)}`;
}

export function ratingOf(p: Pick<DriverProfile, "ratingSum" | "ratingCount"> | null | undefined) {
  if (!p || p.ratingCount === 0) return null;
  return Math.round((p.ratingSum / p.ratingCount) * 10) / 10;
}

export function serializeCounterpart(
  user: User | null | undefined,
  profile: DriverProfile | null | undefined,
  viewer: Viewer,
  opts: { includeLocation?: boolean } = {},
): RideCounterpartDTO | null {
  if (!user) return null;
  const staff = viewer.role === "admin" || viewer.role === "support";
  const dto: RideCounterpartDTO = {
    id: user.id,
    name: user.name,
    phoneMasked: staff ? user.phone : maskPhone(user.phone),
    rating: ratingOf(profile),
    ratingCount: profile?.ratingCount ?? 0,
  };
  if (profile) {
    dto.vehicle = {
      make: profile.vehicleMake,
      model: profile.vehicleModel,
      color: profile.vehicleColor,
      plate: profile.vehiclePlate,
      class: profile.vehicleClass,
    };
    if (opts.includeLocation && profile.lastLat != null && profile.lastLng != null) {
      dto.location = {
        lat: profile.lastLat,
        lng: profile.lastLng,
        heading: profile.lastHeading,
        at: (profile.lastLocationAt ?? new Date()).toISOString(),
      };
    }
  }
  return dto;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function serializeRide(
  ride: Ride,
  ctx: {
    serviceType: ServiceType;
    rider?: User | null;
    driver?: User | null;
    driverProfile?: DriverProfile | null;
    offer?: RideOffer | null;
  },
  viewer: Viewer,
): RideDTO {
  const staff = viewer.role === "admin" || viewer.role === "support";
  const isRider = viewer.id === ride.riderId;
  const isDriver = viewer.id === ride.driverId || viewer.id === ride.offeredDriverId;
  const showDriverLocation = isRider || staff;
  return {
    id: ride.id,
    status: ride.status,
    serviceType: serializeServiceType(ctx.serviceType),
    pickup: { lat: ride.pickupLat, lng: ride.pickupLng, address: ride.pickupAddress },
    dropoff: { lat: ride.dropoffLat, lng: ride.dropoffLng, address: ride.dropoffAddress },
    polyline: ride.polyline,
    estimatedDistanceM: ride.estimatedDistanceM,
    estimatedDurationS: ride.estimatedDurationS,
    actualDistanceM: ride.actualDistanceM,
    actualDurationS: ride.actualDurationS,
    quotedFare: ride.quotedFare,
    finalFare: ride.finalFare,
    quotedTotalAgorot: ride.quotedTotalAgorot,
    finalTotalAgorot: ride.finalTotalAgorot,
    commissionAgorot: ride.commissionAgorot,
    driverPayoutAgorot: ride.driverPayoutAgorot,
    cancellationFeeAgorot: ride.cancellationFeeAgorot,
    refundedAgorot: ride.refundedAgorot,
    paymentMethod: ride.paymentMethod,
    paymentStatus: ride.paymentStatus,
    offerExpiresAt: iso(ride.offerExpiresAt),
    offerAttempts: ride.offerAttempts,
    requestedAt: ride.requestedAt.toISOString(),
    acceptedAt: iso(ride.acceptedAt),
    arrivingAt: iso(ride.arrivingAt),
    arrivedAt: iso(ride.arrivedAt),
    startedAt: iso(ride.startedAt),
    completedAt: iso(ride.completedAt),
    cancelledAt: iso(ride.cancelledAt),
    cancelledBy: ride.cancelledBy,
    cancelReason: ride.cancelReason,
    riderRating: ride.riderRating,
    driverRating: ride.driverRating,
    flags: staff ? ride.flags : [],
    isDemo: ride.isDemo,
    rider: isRider ? null : serializeCounterpart(ctx.rider, null, viewer),
    driver: (isDriver && !staff) ? null : serializeCounterpart(ctx.driver, ctx.driverProfile, viewer, { includeLocation: showDriverLocation }),
    offer:
      ctx.offer && (isDriver || staff)
        ? {
            id: ctx.offer.id,
            driverDistanceM: ctx.offer.driverDistanceM,
            driverEtaS: ctx.offer.driverEtaS,
            driverPayoutAgorot: ctx.offer.driverPayoutAgorot,
            expiresAt: ctx.offer.expiresAt.toISOString(),
          }
        : null,
    adminNotes: staff ? ride.adminNotes : undefined,
  };
}

export function serializeRideEvent(e: RideEvent): RideEventDTO {
  return { id: e.id, type: e.type, actorRole: e.actorRole, data: e.data, createdAt: e.createdAt.toISOString() };
}

export function serializeDriverProfile(p: DriverProfile): DriverProfileDTO {
  return {
    userId: p.userId,
    verificationStatus: p.verificationStatus,
    availability: p.availability,
    serviceTypeIds: p.serviceTypeIds,
    vehicleClass: p.vehicleClass,
    vehicleMake: p.vehicleMake,
    vehicleModel: p.vehicleModel,
    vehicleColor: p.vehicleColor,
    vehiclePlate: p.vehiclePlate,
    vehicleYear: p.vehicleYear,
    seats: p.seats,
    licenseNumber: p.licenseNumber,
    taxiLicenseNumber: p.taxiLicenseNumber,
    lastLocation:
      p.lastLat != null && p.lastLng != null
        ? { lat: p.lastLat, lng: p.lastLng, heading: p.lastHeading, at: (p.lastLocationAt ?? new Date()).toISOString() }
        : null,
    offersReceived: p.offersReceived,
    offersAccepted: p.offersAccepted,
    rating: ratingOf(p),
    ratingCount: p.ratingCount,
    rejectionReason: p.rejectionReason,
    reviewNotes: p.reviewNotes,
    reviewedAt: iso(p.reviewedAt),
    createdAt: p.createdAt.toISOString(),
  };
}

export function serializeDocument(d: DriverDocument): DriverDocumentDTO {
  return {
    id: d.id,
    type: d.type,
    status: d.status,
    fileName: d.fileName,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    expiresAt: iso(d.expiresAt),
    reviewNotes: d.reviewNotes,
    reviewedAt: iso(d.reviewedAt),
    uploadedAt: d.uploadedAt.toISOString(),
  };
}
