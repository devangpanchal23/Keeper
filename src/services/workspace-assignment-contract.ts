export interface WorkspaceAssignmentParents {
  workspaceId: string;
  mediaId: string;
  mediaWorkspaceId: string | null;
  collectionId: string | null;
  collectionWorkspaceId: string | null;
}

export interface WorkspaceAssignmentPersistence {
  transaction<T>(operation: () => Promise<T>): Promise<T>;
  findMediaWorkspaceId(mediaId: string): Promise<string | null>;
  findCollectionWorkspaceId(workspaceId: string, collectionId: string): Promise<string | null>;
  writeAssignment(): Promise<void>;
}

/** Use identical, non-disclosing ownership failures across standalone providers. */
export function validateWorkspaceAssignmentParents(parents: WorkspaceAssignmentParents): void {
  if (!parents.workspaceId || !parents.mediaId) {
    throw Object.assign(new Error("INVALID_ASSIGNMENT"), { code: "22023" });
  }
  if (parents.mediaWorkspaceId !== parents.workspaceId) {
    throw Object.assign(new Error("MEDIA_NOT_FOUND"), { code: "P0002" });
  }
  if (parents.collectionId !== null && parents.collectionWorkspaceId !== parents.workspaceId) {
    throw Object.assign(new Error("COLLECTION_NOT_FOUND"), { code: "P0002" });
  }
}

/** Shared ordering contract: parent reads and the assignment write run in one provider transaction. */
export function persistWorkspaceAssignment(
  parents: Pick<WorkspaceAssignmentParents, "workspaceId" | "mediaId" | "collectionId">,
  persistence: WorkspaceAssignmentPersistence,
): Promise<void> {
  if (!parents.workspaceId || !parents.mediaId || parents.collectionId === "") {
    throw Object.assign(new Error("INVALID_ASSIGNMENT"), { code: "22023" });
  }
  return persistence.transaction(async () => {
    const mediaWorkspaceId = await persistence.findMediaWorkspaceId(parents.mediaId);
    const collectionWorkspaceId = parents.collectionId === null
      ? null
      : await persistence.findCollectionWorkspaceId(parents.workspaceId, parents.collectionId);
    validateWorkspaceAssignmentParents({ ...parents, mediaWorkspaceId, collectionWorkspaceId });
    await persistence.writeAssignment();
  });
}
