import { LogService } from '../../src/main/logging';
import { randomUUID } from 'node:crypto';
const [directory, maxBytes, count] = process.argv.slice(2);
const service = new LogService({
  directory: directory!,
  maxBytes: Number(maxBytes),
  queueLimit: 128,
  metadata: {
    buildId: 'test-build',
    appVersion: 'test',
    electron: 'test',
    chrome: 'test',
    node: process.versions.node,
  },
});
for (let n = 0; n < Number(count); n++)
  service.record({ event: 'application.started', level: 'info', operationId: randomUUID() });
void service.close().then(() => {
  process.stdout.write(JSON.stringify(service.stats));
});
