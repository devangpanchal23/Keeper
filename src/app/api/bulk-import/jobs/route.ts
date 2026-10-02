import { NextRequest, NextResponse } from "next/server";
import { ImportJobService } from "@/services/bulk-import/import-job-service";
import { ImportItem, ImportJobOptions, Platform } from "@/types";
import { getAuthenticatedSupabaseUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedSupabaseUser();
    if (!user) return NextResponse.json({ success: false, error: "Sign in before starting a bulk import." }, { status: 401 });
    const body = await req.json();
    const { platform = "youtube", sourceType = "url_list", sourceName = "Bulk Import", items = [], options = {} } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Items array is required and must not be empty." },
        { status: 400 }
      );
    }

    const job = ImportJobService.createJob({
      userId: user.id,
      platform: platform as Platform,
      sourceType,
      sourceName,
      items: items as ImportItem[],
      options: options as ImportJobOptions,
    });

    return NextResponse.json({ success: true, job }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to create import job." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await getAuthenticatedSupabaseUser();
    if (!user) return NextResponse.json({ success: false, error: "Sign in to view bulk import status." }, { status: 401 });

    const activeJob = ImportJobService.getActiveJob(user.id);
    return NextResponse.json({ success: true, job: activeJob });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to retrieve active job." },
      { status: 500 }
    );
  }
}
