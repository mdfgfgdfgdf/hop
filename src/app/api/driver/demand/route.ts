import { ok, route } from "@/server/api";
import { requireDriver } from "@/server/auth/guards";
import { demandCells } from "@/server/driver/demand";

/** Where ride requests came from in the last hour (counts per ~600 m cell). */
export const GET = route(async () => {
  await requireDriver();
  return ok({ cells: await demandCells() });
});
