import { NextResponse } from "next/server";
import { currentUser } from "@/server/http";

export async function GET() {
  return NextResponse.json({ user: await currentUser() });
}
