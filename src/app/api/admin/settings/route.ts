import { z } from "zod";
import { ok, parseBody, route } from "@/server/api";
import { requireAdmin, requireStaff } from "@/server/auth/guards";
import { getAllSettings, SETTING_DEFAULTS, setSetting, type SettingKey } from "@/server/settings";
import { audit } from "@/server/audit";
import { badRequest } from "@/server/errors";
import { clientIp } from "@/server/security/rate-limit";

export const GET = route(async () => {
  await requireStaff();
  return ok({ settings: await getAllSettings(), defaults: SETTING_DEFAULTS });
});

const schema = z.record(z.string(), z.union([z.number(), z.boolean(), z.string()]));

export const PUT = route(async (req) => {
  const admin = await requireAdmin();
  const input = await parseBody(req, schema);
  for (const [key, value] of Object.entries(input)) {
    if (!(key in SETTING_DEFAULTS)) throw badRequest("unknown_setting", `הגדרה לא מוכרת: ${key}`);
    const def = SETTING_DEFAULTS[key as SettingKey];
    if (typeof def !== typeof value) throw badRequest("bad_type", `ערך לא תקין עבור ${key}`);
    await setSetting(key as SettingKey, value, admin.id);
  }
  await audit({ actorId: admin.id, actorRole: admin.role, action: "settings.update", data: input, ip: clientIp(req) });
  return ok({ settings: await getAllSettings() });
});
