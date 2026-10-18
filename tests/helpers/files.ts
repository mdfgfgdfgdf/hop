/**
 * Upload helpers: an isolated HOP_DATA_DIR per test file and File factories.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { User } from "@/server/db/schema";
import { REQUIRED_DOCUMENTS, uploadDocument } from "@/server/driver/service";

/**
 * Points HOP_DATA_DIR at a fresh temp directory. `env()` is cached on first
 * use, so call this before `freshDb()` (i.e. first thing in `beforeAll`).
 */
export function useTempDataDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hop-test-data-"));
  process.env.HOP_DATA_DIR = dir;
  return {
    dir,
    cleanup: () => fs.promises.rm(dir, { recursive: true, force: true }),
  };
}

export function fileOf(name: string, type: string, bytes: number | Uint8Array<ArrayBuffer> = 16) {
  const data = typeof bytes === "number" ? new Uint8Array(bytes).fill(7) : bytes;
  return new File([data], name, { type });
}

export const pdf = (name = "doc.pdf", bytes: number | Uint8Array<ArrayBuffer> = 64) => fileOf(name, "application/pdf", bytes);

/** Uploads one PDF for every required document type. */
export async function uploadAllRequired(driver: User) {
  const docs = [];
  for (const type of REQUIRED_DOCUMENTS) docs.push(await uploadDocument(driver, { type, file: pdf(`${type}.pdf`) }));
  return docs;
}
