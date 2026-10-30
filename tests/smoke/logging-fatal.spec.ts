import { expect, _electron as electron } from '@playwright/test';
import { test } from './fixtures/test-profile';
import path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';

for (const failure of ['exception', 'rejection']) {
  test(`packaged fatal ${failure} is sanitized, drained and terminates nonzero`, async ({
    profiles,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'packaged', 'Requires packaged main-process automation');
    const profile = profiles.create();
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    );
    delete env.ELECTRON_RUN_AS_NODE;
    const application = await electron.launch({
      executablePath: path.resolve(
        'out',
        `RPG Buddy-${process.platform}-${process.arch}`,
        process.platform === 'win32' ? 'RPG Buddy.exe' : 'RPG Buddy',
      ),
      env,
      args: profile.args,
    });
    const child = application.process();
    profile.track(child);
    try {
      const page = await application.firstWindow();
      await expect(page.getByRole('heading', { name: 'RPG Buddy', exact: true })).toBeVisible();
      await profile.verifyStartup(application);
      const { directory, pid } = await application.evaluate(({ app }) => ({
        directory: app.getPath('userData') + '/logs',
        pid: process.pid,
      }));
      const exited = new Promise<number | null>((resolve) => child.once('exit', resolve));
      await application.evaluate(({}, kind) => {
        setTimeout(() => {
          if (kind === 'rejection') {
            void Promise.reject(new TypeError('password=private'));
            return;
          }
          throw new TypeError('password=private C:\\Users\\Alice\\character.json');
        }, 50);
      }, failure);
      expect(await exited).toBe(1);
      const rows = (
        await Promise.all(
          (await readdir(directory))
            .filter((file) => file.endsWith('.jsonl'))
            .map((file) => readFile(path.join(directory, file), 'utf8')),
        )
      )
        .join('')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      const fatal = rows.filter((row) => row.pid === pid && row.event === 'application.fatal');
      expect(fatal).toHaveLength(1);
      expect(fatal[0].error.name).toBe('TypeError');
      expect(fatal[0].reason).toBe(
        failure === 'exception' ? 'UNCAUGHT_EXCEPTION' : 'UNHANDLED_REJECTION',
      );
      expect(fatal[0].stackFormat).toBe('compiled-js');
      expect(fatal[0].buildId).toMatch(/-production-/);
      expect(fatal[0].error.stack).toContain('[source]');
      expect(JSON.stringify(fatal)).not.toMatch(/password|private|Alice|character\.json/);
    } finally {
      if (child.exitCode === null) await application.close();
    }
  });
}
