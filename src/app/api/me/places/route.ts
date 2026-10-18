import { z } from "zod";
import { created, ok, parseBody, route } from "@/server/api";
import { requireUser } from "@/server/auth/guards";
import { listPlaces, savePlace } from "@/server/places/service";

const schema = z.object({
  kind: z.enum(["home", "work", "other"]),
  label: z.string().trim().max(40).nullish(),
  address: z.string().trim().min(1).max(200),
  lat: z.number().min(29).max(34),
  lng: z.number().min(34).max(36),
});

/** The signed-in user's saved places (home, work, favourites). */
export const GET = route(async () => {
  const user = await requireUser();
  return ok({ places: await listPlaces(user.id) });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, schema);
  return created({ place: await savePlace(user.id, input) });
});
