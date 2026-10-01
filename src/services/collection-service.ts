import { Collection, SavedItem } from "@/types";
import { StorageService } from "./storage-service";

export class CollectionService {
  static getAll(): Collection[] {
    return StorageService.getCollections();
  }

  static getById(id: string): Collection | undefined {
    const list = this.getAll();
    return list.find((c) => c.id === id);
  }

  static create(collection: Omit<Collection, "id" | "createdAt" | "updatedAt">): Collection {
    const collections = this.getAll();
    const newCollection: Collection = {
      ...collection,
      id: `col-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    StorageService.saveCollections([newCollection, ...collections]);
    return newCollection;
  }

  static update(id: string, updates: Partial<Omit<Collection, "id" | "createdAt">>): Collection | null {
    const collections = this.getAll();
    const index = collections.findIndex((c) => c.id === id);
    if (index === -1) return null;

    const updated: Collection = {
      ...collections[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    collections[index] = updated;
    StorageService.saveCollections(collections);
    return updated;
  }

  static delete(id: string): boolean {
    const collections = this.getAll();
    const filtered = collections.filter((c) => c.id !== id);
    if (filtered.length === collections.length) return false;

    StorageService.saveCollections(filtered);

    // Also remove collectionId from any items pointing to this collection
    const items = StorageService.getItems();
    const updatedItems = items.map((item) => {
      if (item.collectionId === id) {
        return { ...item, collectionId: undefined };
      }
      if (item.collections?.includes(id)) {
        return {
          ...item,
          collections: item.collections.filter((cId) => cId !== id),
        };
      }
      return item;
    });
    StorageService.saveItems(updatedItems);
    return true;
  }

  static getItemCount(collectionId: string, items: SavedItem[]): number {
    return items.filter(
      (item) =>
        !item.trashed &&
        !item.archived &&
        (item.collectionId === collectionId || item.collections?.includes(collectionId))
    ).length;
  }
}
