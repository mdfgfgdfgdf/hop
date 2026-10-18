import { z } from "zod";
import { ok, parseBody, route } from "@/server/api";
import { requireDriver } from "@/server/auth/guards";
import { getProfile, listDocuments, REQUIRED_DOCUMENTS, updateProfile } from "@/server/driver/service";
import { serializeDocument, serializeDriverProfile } from "@/server/dispatch/serialize";

export const GET = route(async () => {
  const driver = await requireDriver();
  const [profile, docs] = await Promise.all([getProfile(driver.id), listDocuments(driver.id)]);
  return ok({ profile: serializeDriverProfile(profile), documents: docs.map(serializeDocument), requiredDocuments: REQUIRED_DOCUMENTS });
});

const schema = z.object({
  vehicleClass: z.enum(["standard", "xl", "premium", "accessible"]).optional(),
  vehicleMake: z.string().trim().max(40).optional(),
  vehicleModel: z.string().trim().max(40).optional(),
  vehicleColor: z.string().trim().max(30).optional(),
  vehiclePlate: z.string().trim().min(5).max(12).optional(),
  vehicleYear: z.number().int().min(2005).max(2030).optional(),
  seats: z.number().int().min(1).max(8).optional(),
  licenseNumber: z.string().trim().max(20).optional(),
  taxiLicenseNumber: z.string().trim().max(20).optional(),
  serviceTypeIds: z.array(z.string().max(30)).max(10).optional(),
});

export const PATCH = route(async (req) => {
  const driver = await requireDriver();
  const input = await parseBody(req, schema);
  const profile = await updateProfile(driver, input);
  return ok({ profile: serializeDriverProfile(profile) });
});
