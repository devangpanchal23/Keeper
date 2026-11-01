import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { error: "Paid checkouts are disabled in Keeper Open-Source Edition. All features are freely available without subscription." },
    { status: 410 }
  );
}
