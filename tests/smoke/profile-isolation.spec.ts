import { expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';
import { test } from './fixtures/test-profile';
import type { TestProfile } from './fixtures/test-profile';
import { readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import path from 'node:path';

test('isolated launch cannot write to or rotate a separate active profile', async ({
  profiles,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'packaged',
    'Requires packaged main-process profile inspection',
  );
  const protectedProfile = profiles.create();
  const testProfile = profiles.create();
  expect(protectedProfile.userData).not.toBe(testProfile.userData);
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.RPG_BUDDY_LOG_LEVEL;
  const applications: ElectronApplication[] = [];
  async function launch(profile: TestProfile) {
    const application = await electron.launch({
      executablePath: path.resolve(
        'out',
        `RPG Buddy-${process.platform}-${process.arch}`,
        process.platform === 'win32' ? 'RPG Buddy.exe' : 'RPG Buddy',
      ),
      env,
      args: profile.args,
    });
    profile.track(application.process());
    applications.push(application);
    const page = await application.firstWindow();
    await expect(page.getByRole('heading', { name: 'RPG Buddy', exact: true })).toBeVisible();
    await profile.verifyStartup(application);
    return { application, page };
  }
  const logs = path.join(protectedProfile.userData, 'logs');
  const lock = path.join(logs, '.writer.lock');
  const snapshots = () =>
    Object.fromEntries(
      readdirSync(logs)
        .filter((file) => file.endsWith('.jsonl'))
        .sort()
        .map((file) => [file, readFileSync(path.join(logs, file), 'utf8')]),
    );
  try {
    const normal = await launch(protectedProfile);
    const pid = await normal.application.evaluate(() => process.pid);
    writeFileSync(path.join(logs, 'application.4.jsonl'), '{"protectedEvidence":true}\n');
    // Mimic an active normal writer: a test using this profile would queue/drop
    // its startup records instead of passing its own path/readiness assertions.
    writeFileSync(lock, String(pid));
    const before = snapshots();
    const isolated = await launch(testProfile);
    await isolated.page.getByRole('button', { name: 'Simulate diagnostic failure' }).click();
    await expect(isolated.page.getByRole('status')).toContainText('Diagnostic queued.');
    const records = readFileSync(
      path.join(testProfile.userData, 'logs', 'application.jsonl'),
      'utf8',
    )
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    expect(records.map((row) => row.event)).toEqual(
      expect.arrayContaining([
        'application.started',
        'diagnostic.renderer.failure',
        'diagnostic.main.failure',
      ]),
    );
    expect(snapshots()).toEqual(before);
    expect(readFileSync(lock, 'utf8')).toBe(String(pid));
    expect(records.some((row) => row.protectedEvidence)).toBe(false);
  } finally {
    rmSync(lock, { force: true });
    for (const application of applications.reverse()) {
      const child = application.process();
      if (child.exitCode !== null || child.signalCode !== null) continue;
      const exited = new Promise<number | null>((resolve) => child.once('exit', resolve));
      await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.close());
      expect(await exited).toBe(0);
    }
  }
});
