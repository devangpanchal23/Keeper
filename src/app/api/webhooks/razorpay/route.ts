import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { status: "disabled", message: "Razorpay billing webhooks are disabled in Keeper Open-Source Edition." },
    { status: 200 }
  );
}
