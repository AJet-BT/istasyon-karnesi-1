import { NextRequest, NextResponse } from "next/server";
import { resetAccounts } from "@/lib/server/account-reset";
import { PlatformError } from "@/lib/server/errors";

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(await resetAccounts(request), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status = error instanceof PlatformError ? error.status : 500;
    const message = error instanceof PlatformError ? error.message : "Bakım işlemi tamamlanamadı.";
    return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
  }
}
