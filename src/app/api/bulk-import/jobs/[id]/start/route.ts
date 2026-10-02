import { NextRequest, NextResponse } from "next/server";
import { ImportJobService } from "@/services/bulk-import/import-job-service";
import { getAuthenticatedSupabaseUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedSupabaseUser();
    if (!user) return NextResponse.json({ success: false, error: "Sign in before starting an import." }, { status: 401 });
    const { id } = await context.params;
    const job = ImportJobService.getJobById(id, user.id);
    if (!job) {
      return NextResponse.json(
        { success: false, error: `Import job ${id} not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: false, error: "Server-memory import jobs are retired. Submit each item through the authenticated /api/ingest endpoint so usage is recorded and durable AI work is queued." }, { status: 410 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to start import job." },
      { status: 500 }
    );
  }
}
