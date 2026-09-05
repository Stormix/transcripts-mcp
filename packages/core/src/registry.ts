import type { TranscriptAdapter } from "./adapter";

import { resolve as resolvePath } from "node:path";

import { isPathInside } from "./paths";

export class AdapterRegistry {
  private readonly adapters = new Map<string, TranscriptAdapter>();

  register(adapter: TranscriptAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Adapter already registered: ${adapter.id}`);
    }
    this.adapters.set(adapter.id, adapter);
  }

  list(): TranscriptAdapter[] {
    return [...this.adapters.values()];
  }

  get(id: string): TranscriptAdapter | undefined {
    return this.adapters.get(id);
  }

  async resolve(id: string): Promise<TranscriptAdapter | undefined> {
    const adapter = this.get(id);
    if (adapter === undefined) return undefined;
    if (!(await adapter.isAvailable())) return undefined;
    return adapter;
  }

  async listAvailable(): Promise<TranscriptAdapter[]> {
    const available: TranscriptAdapter[] = [];
    for (const adapter of this.adapters.values()) {
      if (await adapter.isAvailable()) {
        available.push(adapter);
      }
    }
    return available;
  }

  resolveByPath(filePath: string): TranscriptAdapter | undefined {
    let owner: TranscriptAdapter | undefined;
    let ownerRootLength = -1;
    for (const adapter of this.adapters.values()) {
      const root = resolvePath(adapter.root());
      if (!isPathInside(filePath, root)) continue;
      if (root.length > ownerRootLength) {
        owner = adapter;
        ownerRootLength = root.length;
      }
    }
    return owner;
  }
}

const defaultRegistry = new AdapterRegistry();

export function createRegistry(adapters: TranscriptAdapter[] = []): AdapterRegistry {
  const registry = new AdapterRegistry();
  for (const adapter of adapters) {
    registry.register(adapter);
  }
  return registry;
}

export function register(adapter: TranscriptAdapter): void {
  defaultRegistry.register(adapter);
}

export function list(): TranscriptAdapter[] {
  return defaultRegistry.list();
}

export function get(id: string): TranscriptAdapter | undefined {
  return defaultRegistry.get(id);
}

export function resolve(id: string): Promise<TranscriptAdapter | undefined> {
  return defaultRegistry.resolve(id);
}

export function listAvailable(): Promise<TranscriptAdapter[]> {
  return defaultRegistry.listAvailable();
}

export function resolveByPath(filePath: string): TranscriptAdapter | undefined {
  return defaultRegistry.resolveByPath(filePath);
}
