import fs from 'node:fs/promises';
import path from 'node:path';
import { READER_ACCOUNTS } from './config.js';

for (const account of READER_ACCOUNTS) {
  await fs.mkdir(path.resolve('reader/profiles', account.key), { recursive: true });
  await fs.mkdir(path.resolve('reader/snapshots', account.key), { recursive: true });
}
await fs.mkdir(path.resolve('reader/logs'), { recursive: true });
console.log('Reader 폴더 준비 완료. 다음 명령: npm run reader');
