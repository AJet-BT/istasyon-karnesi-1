import { NextRequest, NextResponse } from "next/server";
import { adminReferenceData, createAdminUser, listAdminUsers } from "@/lib/server/admin";
import { adminActor, jsonError } from "../_helpers";

export async function GET(request: NextRequest) {
  try {
    const actor = await adminActor(request);
    const includeArchived = request.nextUrl.searchParams.get("archived") === "true";
    const [users, reference] = await Promise.all([listAdminUsers(actor, includeArchived), adminReferenceData(actor)]);
    return NextResponse.json({ users, ...reference });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await adminActor(request, true);
    return NextResponse.json(await createAdminUser(actor, await request.json()), { status: 201 });
  } catch (error) { return jsonError(error); }
}
