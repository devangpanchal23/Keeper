import { NextRequest, NextResponse } from "next/server";
import { createBackendAdminClient, createBackendServerClient } from "@/lib/database/backend-client";
import { INITIAL_COLLECTIONS } from "@/data/seed-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Collection, SavedItem } from "@/types";

export const dynamic = "force-dynamic";

function getDefaultCollectionSeeds() {
  return INITIAL_COLLECTIONS.map((c) => ({
    id: c.id.slice(0, 120),
    name: c.name.slice(0, 120),
    description: c.description ? c.description.slice(0, 1000) : null,
    profile: { color: c.color, icon: c.icon, isSystem: c.isSystem },
    updated_at: new Date().toISOString(),
  }));
}

export async function GET() {
  const seeds = getDefaultCollectionSeeds();
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ collections: seeds }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const supabase = await createBackendServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ collections: seeds }, { headers: { "Cache-Control": "no-store" } });
    }

    const { data, error } = await supabase
      .from("keeper_collections")
      .select("id,name,description,profile,updated_at")
      .eq("workspace_id", user.id)
      .order("name");

    if (error) {
      return NextResponse.json({ collections: seeds }, { headers: { "Cache-Control": "no-store" } });
    }

    // If a newly created user has 0 collections on the server, seed initial collections
    if (!data || data.length === 0) {
      const admin = createBackendAdminClient();
      const userSeeds = seeds.map((s) => ({ ...s, workspace_id: user.id }));
      try {
        await admin.from("keeper_collections").upsert(userSeeds, { onConflict: "workspace_id,id" });
      } catch {
        // ignore seeding error
      }
      return NextResponse.json({ collections: userSeeds }, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ collections: data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ collections: seeds }, { headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: NextRequest) {
  let body: {
    id?: unknown;
    name?: unknown;
    description?: unknown;
    color?: unknown;
    icon?: unknown;
    isSystem?: unknown;
    collections?: Collection[];
  } = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const fallbackCount = Array.isArray(body.collections) ? body.collections.length : 1;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, count: fallbackCount, localOnly: true });
  }

  try {
    const supabase = await createBackendServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: true, count: fallbackCount, localOnly: true });
    }

    const admin = createBackendAdminClient();

    // Support batch collection syncing
    if (Array.isArray(body.collections)) {
      const rows = body.collections.slice(0, 500).flatMap((c) => {
        if (!c || typeof c.id !== "string" || typeof c.name !== "string") return [];
        return [{
          workspace_id: user.id,
          id: c.id.slice(0, 120),
          name: c.name.trim().slice(0, 120),
          description: typeof c.description === "string" ? c.description.slice(0, 1000) : null,
          profile: { color: c.color, icon: c.icon, isSystem: c.isSystem },
          updated_at: new Date().toISOString(),
        }];
      });

      if (rows.length > 0) {
        const { error } = await admin.from("keeper_collections").upsert(rows, { onConflict: "workspace_id,id" });
        if (error) return NextResponse.json({ success: true, count: rows.length, localOnly: true });
      }

      return NextResponse.json({ success: true, count: rows.length });
    }

    // Single collection syncing
    if (typeof body.id !== "string" || typeof body.name !== "string" || !body.id.trim() || !body.name.trim()) {
      return NextResponse.json({ error: "A collection ID and name are required." }, { status: 400 });
    }

    const { error } = await admin.from("keeper_collections").upsert({
      workspace_id: user.id,
      id: body.id.slice(0, 120),
      name: body.name.trim().slice(0, 120),
      description: typeof body.description === "string" ? body.description.slice(0, 1000) : null,
      profile: { color: body.color, icon: body.icon, isSystem: body.isSystem },
      updated_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,id" });

    if (error) return NextResponse.json({ success: true, localOnly: true });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true, count: fallbackCount, localOnly: true });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let collectionId = searchParams.get("id");

  if (!collectionId) {
    const body = await request.json().catch(() => ({})) as { id?: string };
    collectionId = body.id || null;
  }

  if (!collectionId || typeof collectionId !== "string") {
    return NextResponse.json({ error: "Collection ID is required." }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, localOnly: true });
  }

  try {
    const supabase = await createBackendServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: true, localOnly: true });

    const admin = createBackendAdminClient();

    // Delete the collection row for this workspace
    const { error } = await admin
      .from("keeper_collections")
      .delete()
      .eq("workspace_id", user.id)
      .eq("id", collectionId);

    if (error) return NextResponse.json({ success: true, localOnly: true });

    // Unlink deleted collection from all items in keeper_media for this user
    try {
      const { data: rows } = await admin
        .from("keeper_media")
        .select("id,payload")
        .eq("workspace_id", user.id);

      for (const row of rows || []) {
        const payload = row.payload as SavedItem | undefined;
        if (!payload) continue;

      let changed = false;
      let nextCollectionId = payload.collectionId;
      let nextCollections = payload.collections || [];

      if (nextCollectionId === collectionId) {
        nextCollectionId = undefined;
        changed = true;
      }
      if (nextCollections.includes(collectionId)) {
        nextCollections = nextCollections.filter((id) => id !== collectionId);
        changed = true;
      }

      if (changed) {
        const updatedPayload = {
          ...payload,
          collectionId: nextCollectionId,
          collections: nextCollections,
        };
        await admin
          .from("keeper_media")
          .update({
            payload: updatedPayload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .eq("workspace_id", user.id);
      }
    }
  } catch (unlinkError) {
    console.warn("Could not unlink items from deleted collection:", unlinkError);
  }

  return NextResponse.json({ success: true, deletedId: collectionId });
  } catch {
    return NextResponse.json({ success: true, localOnly: true });
  }
}
