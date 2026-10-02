import { NextRequest, NextResponse } from "next/server";
import { ImportJobService } from "@/services/bulk-import/import-job-service";
import { getAuthenticatedSupabaseUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedSupabaseUser();
    if (!user) return NextResponse.json({ success: false, error: "Sign in to view import reports." }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const userId = user.id;
    const reportId = searchParams.get("id");

    if (reportId) {
      const report = ImportJobService.getReportById(userId, reportId);
      if (!report) {
        return NextResponse.json({ success: false, error: "Report not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, report });
    }

    const reports = ImportJobService.getReports(userId);
    return NextResponse.json({ success: true, reports });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to retrieve reports." },
      { status: 500 }
    );
  }
}
