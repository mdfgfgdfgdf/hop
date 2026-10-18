import { route } from "@/server/api";
import { requireUser } from "@/server/auth/guards";
import { getDocumentForViewer, readDocumentFile } from "@/server/driver/service";

/** Streams the document file to its owner or to staff. */
export const GET = route<{ id: string }>(async (_req, ctx) => {
  const user = await requireUser(["driver", "admin", "support"]);
  const { id } = await ctx.params;
  const doc = await getDocumentForViewer(id, user);
  const bytes = await readDocumentFile(doc);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
