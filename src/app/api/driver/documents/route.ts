import { created, ok, route } from "@/server/api";
import { requireDriver } from "@/server/auth/guards";
import { listDocuments, uploadDocument, DOCUMENT_LABELS_HE, REQUIRED_DOCUMENTS } from "@/server/driver/service";
import { serializeDocument } from "@/server/dispatch/serialize";
import { badRequest } from "@/server/errors";
import { documentTypeEnum } from "@/server/db/schema";
import { clientIp, rateLimit } from "@/server/security/rate-limit";

export const GET = route(async () => {
  const driver = await requireDriver();
  const docs = await listDocuments(driver.id);
  return ok({ documents: docs.map(serializeDocument), requiredDocuments: REQUIRED_DOCUMENTS, labels: DOCUMENT_LABELS_HE });
});

/** multipart/form-data: type, file, expiresAt? */
export const POST = route(async (req) => {
  const driver = await requireDriver();
  rateLimit(`doc-upload:${driver.id}`, 30, 10 * 60_000);
  rateLimit(`doc-upload-ip:${clientIp(req)}`, 60, 10 * 60_000);
  const form = await req.formData().catch(() => {
    throw badRequest("bad_form", "נדרש multipart/form-data");
  });
  const type = String(form.get("type") ?? "");
  if (!(documentTypeEnum.enumValues as readonly string[]).includes(type)) throw badRequest("bad_type", "סוג מסמך לא מוכר");
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("no_file", "לא צורף קובץ");
  const expiresRaw = form.get("expiresAt");
  const expiresAt = expiresRaw ? new Date(String(expiresRaw)) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) throw badRequest("bad_date", "תאריך תפוגה אינו תקין");
  const doc = await uploadDocument(driver, { type: type as (typeof documentTypeEnum.enumValues)[number], file, expiresAt });
  return created({ document: serializeDocument(doc) });
});
