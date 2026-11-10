import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { isSystemId } from '../shared/library-selection';
import type { LibraryOutcome, LibraryResult, LibraryView } from '../shared/library-selection';
import type { Logger } from '../shared/logging-contract';
import { loadActiveSystem } from './definition-loader';
import type { LoadedSystem } from './definition-loader';
import { SYSTEMS_DIRECTORY } from './library-paths';
import { readLibraryPreference, writeLibraryPreference } from './library-preference';

interface DiscoveredLibrary {
  root: string;
  systemIds: string[];
}

// Discover stable IDs from immediate directory entries without opening definition files.
async function discoverLibrary(folder: string): Promise<DiscoveredLibrary> {
  if (!path.isAbsolute(folder)) throw new Error('Expected an absolute library folder.');
  const root = await realpath(folder);
  const directory = path.join(root, SYSTEMS_DIRECTORY);
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error('Expected an ordinary RPG_systems directory.');
  }
  // Compare the on-disk spelling because Windows may resolve the requested casing anyway.
  const resolvedDirectory = await realpath(directory);
  if (path.relative(root, resolvedDirectory) !== SYSTEMS_DIRECTORY) {
    throw new Error(`Expected a directory named exactly ${SYSTEMS_DIRECTORY}.`);
  }
  const entries = await readdir(resolvedDirectory, { withFileTypes: true });
  const systemIds = entries
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink() && isSystemId(entry.name))
    .map((entry) => entry.name)
    .sort();
  return { root, systemIds };
}

/** Own the folder, discovery results and single active catalog for one application session. */
export class LibrarySelection {
  private library?: DiscoveredLibrary;
  private active?: LoadedSystem;
  private issue: string | null = null;
  private generation = 0;
  private choosing = false;
  private pendingLoad?: { done: Promise<void>; settle: () => void };
  private readonly ready: Promise<void>;

  /**
   * Restore the remembered folder without loading a system.
   * @param profilePath Electron user-data folder.
   * @param logger Shared application logger.
   * @param loadSystem Definition loader, injectable to exercise competing requests.
   */
  constructor(
    private readonly profilePath: string,
    private readonly logger: Logger,
    private readonly loadSystem = loadActiveSystem,
  ) {
    this.ready = this.restore();
  }

  // Restore directory metadata only. Keep recovery available if the preference is unusable.
  private async restore(): Promise<void> {
    try {
      const remembered = await readLibraryPreference(this.profilePath);
      if (remembered) this.library = await discoverLibrary(remembered);
    } catch {
      this.issue =
        'The remembered library folder is unavailable. Choose a library folder to continue.';
    }
  }

  // Return a copy of renderer-safe state. The absolute path and catalog stay in main.
  private reply(outcome: LibraryOutcome, issue = this.issue): LibraryResult {
    const manifest = this.active?.manifest;
    const view: LibraryView = {
      folderName: this.library ? path.basename(this.library.root) || 'Drive root' : null,
      systemIds: [...(this.library?.systemIds ?? [])],
      activeSystem: manifest ? { id: manifest.id, label: manifest.label } : null,
      issue,
    };
    return { ok: true, outcome, view };
  }

  // Release view readers waiting on the previous load when a newer selection supersedes it.
  private settlePendingLoad(): void {
    const pending = this.pendingLoad;
    this.pendingLoad = undefined;
    pending?.settle();
  }

  /**
   * Get the current library view after restoring the preference and settling any selection in flight.
   * @returns The renderer-safe view of folder, system choices and current selection.
   */
  async getView(): Promise<LibraryResult> {
    await this.ready;
    // A reloaded renderer has no access to the previous renderer's load reply.
    while (this.pendingLoad) await this.pendingLoad.done;
    return this.reply('current');
  }

  /**
   * Open a folder picker, validate the chosen folder and remember it.
   * @param pick Native picker callback returning an absolute path or undefined on cancellation.
   * @returns The current view with the picker outcome.
   */
  async chooseFolder(pick: () => Promise<string | undefined>): Promise<LibraryResult> {
    await this.ready;
    if (this.choosing) return this.reply('superseded');
    this.choosing = true;
    try {
      const folder = await pick();
      if (folder === undefined) return this.reply('cancelled');

      // Keep the existing library usable until discovery and the profile write both succeed.
      let discovered: DiscoveredLibrary;
      try {
        discovered = await discoverLibrary(folder);
      } catch {
        return this.reply(
          'failed',
          `Choose a readable library folder that contains a directory named exactly ${SYSTEMS_DIRECTORY}.`,
        );
      }
      try {
        await writeLibraryPreference(this.profilePath, discovered.root);
      } catch {
        return this.reply(
          'failed',
          'The library folder could not be remembered. Check access to the application profile and try again.',
        );
      }

      this.generation++;
      this.settlePendingLoad();
      this.active = undefined;
      this.library = discovered;
      this.issue = null;
      return this.reply('accepted');
    } finally {
      this.choosing = false;
    }
  }

  /**
   * Load a discovered system as the active selection.
   * @param systemId Candidate ID from the current library view.
   * @returns The accepted or rejected selection, or the latest view if superseded.
   */
  async selectSystem(systemId: string): Promise<LibraryResult> {
    await this.ready;
    if (!this.library?.systemIds.includes(systemId)) {
      return this.reply('failed', 'Choose a system from the current library.');
    }

    // Release the previous catalog before I/O. Only the newest selection may publish.
    const generation = ++this.generation;
    this.settlePendingLoad();
    let settle!: () => void;
    const done = new Promise<void>((resolve) => {
      settle = resolve;
    });
    this.pendingLoad = { done, settle };
    this.active = undefined;
    this.issue = null;
    try {
      const result = await this.loadSystem(this.library.root, systemId, this.logger);
      if (generation !== this.generation) return this.reply('superseded');
      if (result.success) {
        this.active = result.value;
        return this.reply('accepted');
      }
      const { document, pointer, message } = result.diagnostics[0];
      this.issue = `Could not load ${systemId}. ${document}${pointer ? ' ' + pointer : ''}. ${message}`;
    } catch {
      if (generation !== this.generation) return this.reply('superseded');
      this.issue = `Could not load ${systemId}. Try again or choose another system.`;
    } finally {
      if (generation === this.generation) this.settlePendingLoad();
    }
    return this.reply('failed');
  }

  /**
   * Access the active catalog from the main process.
   * @returns The current catalog, or undefined during replacement or after rejection.
   */
  getActiveCatalog(): LoadedSystem['catalog'] | undefined {
    return this.active?.catalog;
  }
}
