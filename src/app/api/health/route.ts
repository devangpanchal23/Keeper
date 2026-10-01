import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();

  try {
    const memory = process.memoryUsage();

    return NextResponse.json(
      {
        status: "healthy",
        service: "recall-app",
        version: "0.1.0",
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV || "development",
        checks: {
          server: "ok",
          memory: {
            rssMb: Math.round(memory.rss / (1024 * 1024)),
            heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024)),
          },
        },
        latencyMs: Date.now() - startTime,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Internal health check error",
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}
