import { NextRequest, NextResponse } from "next/server";
import { archiveAdminUser, getAdminUser, updateAdminUser } from "@/lib/server/admin";
import { adminActor, jsonError } from "../../_helpers";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  try { return NextResponse.json(await getAdminUser(await adminActor(request), (await context.params).id)); }
  catch (error) { return jsonError(error); }
}

export async function PATCH(request: NextRequest, context: Context) {
  try { return NextResponse.json(await updateAdminUser(await adminActor(request, true), (await context.params).id, await request.json())); }
  catch (error) { return jsonError(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try { return NextResponse.json(await archiveAdminUser(await adminActor(request, true), (await context.params).id)); }
  catch (error) { return jsonError(error); }
}
