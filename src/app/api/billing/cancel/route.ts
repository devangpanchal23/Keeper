import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { error: "Subscription cancellation is not applicable in Keeper Open-Source Edition." },
    { status: 410 }
  );
}
