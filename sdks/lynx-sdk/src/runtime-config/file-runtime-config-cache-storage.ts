import { open, mkdir, readFile, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { LynxRuntimeConfigCacheStorage } from "../core/types.js";

/**
 * Persists `.lynxconf` bytes with an atomic same-directory file replacement.
 *
 * Temporary files use owner-only permissions where the operating system
 * supports POSIX file modes.
 */
export class FileRuntimeConfigCacheStorage implements LynxRuntimeConfigCacheStorage {
  constructor(readonly path: string) {}

  /** Reads the cache without treating a missing file as an error. */
  async read(): Promise<Uint8Array | null> {
    try {
      return await readFile(this.path);
    } catch (error) {
      if (isFileSystemError(error, "ENOENT")) return null;
      throw error;
    }
  }

  /** Flushes a temporary file before atomically replacing the active cache. */
  async write(data: Uint8Array): Promise<void> {
    const directory = dirname(this.path);
    const temporaryPath = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
    await mkdir(directory, { recursive: true });

    try {
      const handle = await open(temporaryPath, "wx", 0o600);
      try {
        await handle.writeFile(data);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporaryPath, this.path);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }

  /** Removes a cache that cannot be decoded or does not match this SDK. */
  async remove(): Promise<void> {
    try {
      await unlink(this.path);
    } catch (error) {
      if (!isFileSystemError(error, "ENOENT")) throw error;
    }
  }
}

/** Narrows Node.js filesystem errors without exposing platform-specific types. */
function isFileSystemError(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}
