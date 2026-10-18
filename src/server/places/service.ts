/**
 * Saved places (home, work, favourites). A user only ever sees and changes
 * their own; home and work are one each, favourites are capped.
 */
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { savedPlaces, type SavedPlace } from "../db/schema";
import { badRequest, conflict, notFound } from "../errors";
import type { SavedPlaceDTO } from "@/lib/types";

export const MAX_FAVOURITES = 20;

const toDTO = (p: SavedPlace): SavedPlaceDTO => ({ id: p.id, kind: p.kind, label: p.label, address: p.address, lat: p.lat, lng: p.lng });

export async function listPlaces(userId: string): Promise<SavedPlaceDTO[]> {
  const db = await getDb();
  const rows = await db.select().from(savedPlaces).where(eq(savedPlaces.userId, userId)).orderBy(asc(savedPlaces.createdAt));
  const order = { home: 0, work: 1, other: 2 } as const;
  return rows.sort((a, b) => order[a.kind] - order[b.kind]).map(toDTO);
}

export type PlaceInput = { kind: "home" | "work" | "other"; label?: string | null; address: string; lat: number; lng: number };

/** Home/work replace the previous one; favourites are added. */
export async function savePlace(userId: string, input: PlaceInput): Promise<SavedPlaceDTO> {
  const address = input.address.trim();
  if (!address) throw badRequest("invalid_place", "חסרה כתובת");
  const label = (input.label?.trim() || (input.kind === "home" ? "בית" : input.kind === "work" ? "עבודה" : address)).slice(0, 40);
  const db = await getDb();
  if (input.kind !== "other") {
    const [existing] = await db.select().from(savedPlaces).where(and(eq(savedPlaces.userId, userId), eq(savedPlaces.kind, input.kind)));
    if (existing) {
      const [row] = await db
        .update(savedPlaces)
        .set({ label, address, lat: input.lat, lng: input.lng, updatedAt: new Date() })
        .where(eq(savedPlaces.id, existing.id))
        .returning();
      return toDTO(row);
    }
  } else {
    const favourites = await db.select({ id: savedPlaces.id }).from(savedPlaces).where(and(eq(savedPlaces.userId, userId), eq(savedPlaces.kind, "other")));
    if (favourites.length >= MAX_FAVOURITES) throw conflict("too_many_places", `אפשר לשמור עד ${MAX_FAVOURITES} מקומות`);
  }
  const [row] = await db.insert(savedPlaces).values({ userId, kind: input.kind, label, address, lat: input.lat, lng: input.lng }).returning();
  return toDTO(row);
}

export async function deletePlace(userId: string, id: string) {
  const db = await getDb();
  const deleted = await db
    .delete(savedPlaces)
    .where(and(eq(savedPlaces.id, id), eq(savedPlaces.userId, userId)))
    .returning({ id: savedPlaces.id });
  if (!deleted.length) throw notFound("המקום לא נמצא");
  return { deleted: true };
}
