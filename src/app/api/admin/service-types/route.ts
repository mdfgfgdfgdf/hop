import { ok, route } from "@/server/api";
import { requireStaff } from "@/server/auth/guards";
import { listServiceTypesAdmin } from "@/server/admin/service";

export const GET = route(async () => {
  await requireStaff();
  return ok({ serviceTypes: await listServiceTypesAdmin() });
});
