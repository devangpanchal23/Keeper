import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { error: "Payment verification is disabled in Keeper Open-Source Edition." },
    { status: 410 }
  );
}
