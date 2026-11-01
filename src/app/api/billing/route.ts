import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      openSource: true,
      tier: "free",
      current: null,
      subscriptions: [],
      payments: [],
      message: "Keeper Open-Source Edition: All features are freely available without subscription.",
    },
    {
      headers: { "Cache-Control": "no-store" },
    }
  );
}
