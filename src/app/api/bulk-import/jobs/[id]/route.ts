import { NextRequest, NextResponse } from "next/server";
import { ImportJobService } from "@/services/bulk-import/import-job-service";
import { getAuthenticatedSupabaseUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedSupabaseUser();
    if (!user) return NextResponse.json({ success: false, error: "Sign in to read import status." }, { status: 401 });
    const { id } = await context.params;

    const job = ImportJobService.getJobById(id, user.id);
    if (!job) {
      return NextResponse.json(
        { success: false, error: `Import job ${id} not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, job });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to retrieve job." },
      { status: 500 }
    );
  }
}
