import { NextRequest, NextResponse } from "next/server";
import { createPort, getPortMaster } from "@/lib/server/ports";
import { adminActor, jsonError } from "../_helpers";

export async function GET(request: NextRequest) {
  try { return NextResponse.json(await getPortMaster(await adminActor(request))); }
  catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest) {
  try { return NextResponse.json(await createPort(await adminActor(request, true), await request.json()), { status: 201 }); }
  catch (error) { return jsonError(error); }
}
