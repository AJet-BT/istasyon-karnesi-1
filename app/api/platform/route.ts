import { NextRequest, NextResponse } from "next/server";
import {
  PlatformError,
  createExportJob,
  getAdminPayload,
  getAuditForWorkspace,
  getDashboardPayload,
  getSessionPayload,
  importWorkbook,
  previewWorkbook,
  deleteExportJob,
  reprocessUpload,
  requireActor,
  requirePasswordReady,
  restoreUpload,
  saveUserView,
  softDeleteUpload,
} from "@/lib/server/platform";
import { assertSameOrigin } from "@/lib/server/auth";
import type { ImportSelection } from "@/lib/workbook-import";

function jsonError(error: unknown) {
  if (error instanceof PlatformError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Platform API error", error);
  const cause = error instanceof Error && "cause" in error && error.cause instanceof Error
    ? ` · ${error.cause.message}`
    : "";
  const diagnostic = process.env.NODE_ENV !== "production" && error instanceof Error
    ? `İşlem tamamlanamadı: ${error.message}${cause}`
    : "İşlem tamamlanamadı.";
  return NextResponse.json({ error: diagnostic }, { status: 500 });
}

function parseFilters(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return {
    period: params.get("period") || undefined,
    comparisonPeriod: params.get("comparisonPeriod") || undefined,
    provider: params.get("provider") || undefined,
    region: params.get("region") || undefined,
    country: params.get("country") || undefined,
    city: params.get("city") || undefined,
    sourceFile: params.get("sourceFile") || undefined,
    dataStatus: params.get("dataStatus") || undefined,
    ports: params.get("ports")?.split(",").map((value) => value.trim()).filter(Boolean),
  };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireActor(request);
    const resource = request.nextUrl.searchParams.get("resource") || "dashboard";
    if (resource === "session") return NextResponse.json(await getSessionPayload(actor));
    requirePasswordReady(actor);
    if (resource === "dashboard") return NextResponse.json(await getDashboardPayload(actor, parseFilters(request)));
    if (resource === "admin") return NextResponse.json(await getAdminPayload(actor));
    if (resource === "audit") return NextResponse.json(await getAuditForWorkspace(actor));
    throw new PlatformError("Bilinmeyen kaynak.", 404);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor(request);
    requirePasswordReady(actor);
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new PlatformError("Dosya seçilmedi.");
      let selection: Partial<ImportSelection> | undefined;
      const selectionJson = form.get("selection");
      if (selectionJson !== null) {
        if (typeof selectionJson !== "string" || selectionJson.length > 20000) throw new PlatformError("İçe aktarma seçimi geçersiz.");
        try { selection = JSON.parse(selectionJson) as Partial<ImportSelection>; }
        catch { throw new PlatformError("İçe aktarma seçimi okunamadı."); }
        if (!selection || typeof selection !== "object" || Array.isArray(selection)) throw new PlatformError("İçe aktarma seçimi geçersiz.");
        if ((selection.sheetName !== undefined && typeof selection.sheetName !== "string") || (selection.provider !== undefined && selection.provider !== null && typeof selection.provider !== "string") || (selection.period !== undefined && selection.period !== null && typeof selection.period !== "string") || (selection.headerRow !== undefined && (!Number.isInteger(selection.headerRow) || selection.headerRow < 1)) || (selection.mappings !== undefined && (!selection.mappings || typeof selection.mappings !== "object" || Array.isArray(selection.mappings)))) throw new PlatformError("İçe aktarma seçimi geçersiz.");
      }
      const metadata = {
        title: form.get("title") === null ? undefined : String(form.get("title")),
        selection,
        provider: String(form.get("provider") || "") || undefined,
        period: String(form.get("period") || "") || undefined,
        isTestData: String(form.get("isTestData") || "false") === "true",
        mode: String(form.get("mode") || "replace"),
      };
      if (form.get("action") === "preview") return NextResponse.json(await previewWorkbook(actor, file, metadata));
      return NextResponse.json(await importWorkbook(actor, file, metadata), { status: 201 });
    }
    const payload = await request.json() as Record<string, unknown>;
    switch (payload.action) {
      case "save_view":
        return NextResponse.json(await saveUserView(actor, payload), { status: 201 });
      case "export":
        return NextResponse.json(await createExportJob(actor, payload), { status: 201 });
      case "delete_export":
        if (!payload.id) throw new PlatformError("Rapor kimliği zorunludur.");
        return NextResponse.json(await deleteExportJob(actor, String(payload.id)));
      default:
        throw new PlatformError("Bilinmeyen işlem.", 404);
    }
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor(request);
    requirePasswordReady(actor);
    const payload = await request.json() as { id?: string; reason?: string };
    if (!payload.id) throw new PlatformError("Dosya kimliği zorunludur.");
    return NextResponse.json(await softDeleteUpload(actor, payload.id, payload.reason || "Kullanıcı isteği"));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const actor = await requireActor(request);
    requirePasswordReady(actor);
    const payload = await request.json() as { id?: string; action?: string };
    if (!payload.id) throw new PlatformError("Dosya kimliği zorunludur.");
    if (payload.action === "restore") return NextResponse.json(await restoreUpload(actor, payload.id));
    if (payload.action === "reprocess") return NextResponse.json(await reprocessUpload(actor, payload.id), { status: 201 });
    throw new PlatformError("Geçersiz dosya işlemi.");
  } catch (error) {
    return jsonError(error);
  }
}
