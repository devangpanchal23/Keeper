import { NextRequest, NextResponse } from "next/server";
import { ImportJobService } from "@/services/bulk-import/import-job-service";
import { getAuthenticatedSupabaseUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedSupabaseUser();
    if (!user) return NextResponse.json({ success: false, error: "Sign in to control an import." }, { status: 401 });
    const { id } = await context.params;
    const body = await req.json();
    const { action } = body;

    const job = ImportJobService.getJobById(id, user.id);
    if (!job) {
      return NextResponse.json(
        { success: false, error: `Import job ${id} not found.` },
        { status: 404 }
      );
    }

    switch (action) {
      case "pause":
        ImportJobService.pauseJob(id);
        return NextResponse.json({ success: true, status: "paused" });

      case "resume":
        return NextResponse.json({ success: false, error: "Legacy server-memory jobs cannot be resumed. Re-submit unprocessed items through /api/ingest." }, { status: 410 });

      case "cancel":
        ImportJobService.cancelJob(id);
        return NextResponse.json({ success: true, status: "cancelled" });

      case "retry":
        return NextResponse.json({ success: false, error: "Legacy server-memory jobs cannot be retried. AI work is retried from the durable job queue." }, { status: 410 });

      default:
        return NextResponse.json(
          { success: false, error: `Invalid action '${action}'. Expected pause, resume, cancel, or retry.` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to process job control action." },
      { status: 500 }
    );
  }
}
