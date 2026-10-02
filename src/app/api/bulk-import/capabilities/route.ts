import { NextRequest, NextResponse } from "next/server";
import { OAuthSecurityService } from "@/services/bulk-import/oauth-service";
import { Platform } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = (searchParams.get("platform") || "youtube") as Platform;

  const capabilities = OAuthSecurityService.getPlatformCapabilities(platform);

  return NextResponse.json(
    {
      success: true,
      platform,
      capabilities,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
