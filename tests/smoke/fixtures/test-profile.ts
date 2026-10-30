import { test as base, expect } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';
import type { ChildProcess } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface TestProfile {
  root: string;
  userData: string;
  args: string[];
  processes: { child: ChildProcess; detached: boolean }[];
  track(child: ChildProcess, detached?: boolean): void;
  verifyStartup(application?: ElectronApplication): Promise<void>;
}
export interface ProfileFactory {
  create(): TestProfile;
}

function terminated(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}
export const test = base.extend<{ profiles: ProfileFactory }>({
  profiles: async ({}, use, testInfo) => {
    const profiles: TestProfile[] = [];
    try {
      await use({
        create() {
          const root = mkdtempSync(path.join(os.tmpdir(), 'rpg-buddy-test-'));
          const userData = path.join(root, 'user-data');
          mkdirSync(userData);
          const profile: TestProfile = {
            root,
            userData,
            args: [`--user-data-dir=${userData}`],
            processes: [],
            track(child, detached = false) {
              this.processes.push({ child, detached });
            },
            async verifyStartup(application) {
              if (application) {
                const actual = await application.evaluate(({ app }) => app.getPath('userData'));
                expect(path.resolve(actual)).toBe(path.resolve(userData));
              }
              const startup = path.join(userData, 'logs', 'application.jsonl');
              await expect
                .poll(() => {
                  try {
                    return readFileSync(startup, 'utf8')
                      .split('\n')
                      .filter(Boolean)
                      .some((line) => JSON.parse(line).event === 'application.started');
                  } catch {
                    return false;
                  }
                })
                .toBe(true);
            },
          };
          profiles.push(profile);
          return profile;
        },
      });
    } finally {
      const manifests = [];
      // Attempt every cleanup even when a prior profile/process fails.
      const errors: unknown[] = [];
      for (const [index, profile] of profiles.entries()) {
        try {
          for (const { child, detached } of profile.processes) {
            if (terminated(child)) continue;
            if (child.pid) {
              if (process.platform === 'win32')
                spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
                  windowsHide: true,
                });
              else if (detached) {
                try {
                  process.kill(-child.pid, 'SIGKILL');
                } catch {
                  /* may have exited */
                }
              } else child.kill('SIGKILL');
            }
            await expect.poll(() => terminated(child), { timeout: 10000 }).toBe(true);
          }
          const logs = path.join(profile.userData, 'logs');
          if (existsSync(logs)) {
            for (const file of readdirSync(logs).filter((file) => file.endsWith('.jsonl'))) {
              const artifact = testInfo.outputPath(`profile-${index}-${file}`);
              writeFileSync(artifact, readFileSync(path.join(logs, file)).subarray(-65536));
              await testInfo.attach(`profile-${index}-${file}`, {
                path: artifact,
                contentType: 'text/plain',
              });
            }
          }
          // Explicitly verify the absolute target is a directory created by
          // this factory directly beneath the system temp directory.
          const resolved = path.resolve(profile.root);
          expect(path.dirname(resolved)).toBe(path.resolve(os.tmpdir()));
          expect(path.basename(resolved).startsWith('rpg-buddy-test-')).toBe(true);
          rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
          expect(existsSync(resolved)).toBe(false);
          manifests.push({ root: resolved, processesTerminated: true, removed: true });
        } catch (error) {
          errors.push(error);
        }
      }
      const manifestPath = testInfo.outputPath('profile-cleanup.json');
      writeFileSync(manifestPath, JSON.stringify(manifests));
      await testInfo.attach('profile-cleanup', {
        path: manifestPath,
        contentType: 'application/json',
      });
      if (errors.length) throw new AggregateError(errors, 'Test profile cleanup failed');
    }
  },
});
