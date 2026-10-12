import { NextRequest, NextResponse } from "next/server";
import { updatePort } from "@/lib/server/ports";
import { adminActor, jsonError } from "../../_helpers";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, context: Context) {
  try { return NextResponse.json(await updatePort(await adminActor(request, true), (await context.params).id, await request.json())); }
  catch (error) { return jsonError(error); }
}
