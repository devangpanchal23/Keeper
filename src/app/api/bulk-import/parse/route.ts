import { NextRequest, NextResponse } from "next/server";
import { ExportFileParser } from "@/services/bulk-import/export-parser";
import { InstagramExportAdapter } from "@/services/bulk-import/adapters/instagram-export-adapter";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, filename } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid 'content' string" },
        { status: 400 }
      );
    }

    // Check if content represents an Instagram export
    const igAnalysis = InstagramExportAdapter.parse(content, filename);
    if (igAnalysis.isValid && igAnalysis.candidates.length > 0) {
      return NextResponse.json(
        {
          success: true,
          count: igAnalysis.candidates.length,
          collections: igAnalysis.collections,
          uncollectedCount: igAnalysis.uncollectedCount,
          candidates: igAnalysis.candidates,
        },
        { status: 200 }
      );
    }

    // Default multi-platform export parser
    const candidates = ExportFileParser.parse(content, filename);

    return NextResponse.json(
      {
        success: true,
        count: candidates.length,
        candidates,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to parse import export file.",
      },
      { status: 422 }
    );
  }
}
