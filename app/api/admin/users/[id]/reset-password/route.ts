import { NextRequest, NextResponse } from "next/server";
import { resetAdminUserPassword } from "@/lib/server/admin";
import { adminActor, jsonError } from "../../../_helpers";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, context: Context) {
  try { return NextResponse.json(await resetAdminUserPassword(await adminActor(request, true), (await context.params).id, await request.json())); }
  catch (error) { return jsonError(error); }
}
