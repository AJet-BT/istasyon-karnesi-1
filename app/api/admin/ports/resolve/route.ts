import { NextRequest, NextResponse } from "next/server";
import { resolvePortMapping } from "@/lib/server/ports";
import { adminActor, jsonError } from "../../_helpers";
export async function POST(request: NextRequest) {
  try { return NextResponse.json(await resolvePortMapping(await adminActor(request, true), await request.json())); }
  catch (error) { return jsonError(error); }
}
