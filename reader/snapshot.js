import fs from 'node:fs/promises';
import path from 'node:path';
import { log } from './logger.js';

function safeFileName(value) {
  return value.replace(/[^a-z0-9가-힣_-]+/gi, '_');
}

export async function savePageSnapshot(session) {
  const { account, page } = session;
  const directory = path.resolve('reader/snapshots', account.key);
  await fs.mkdir(directory, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const prefix = `${timestamp}-${safeFileName(account.region)}`;
  const htmlPath = path.join(directory, `${prefix}.html`);
  const imagePath = path.join(directory, `${prefix}.png`);
  const latestPath = path.join(directory, 'latest.json');

  const html = await page.content();
  await fs.writeFile(htmlPath, html, 'utf8');
  await page.screenshot({ path: imagePath, fullPage: true });
  await fs.writeFile(latestPath, JSON.stringify({
    region: account.region,
    url: page.url(),
    capturedAt: new Date().toISOString(),
    htmlPath,
    imagePath,
  }, null, 2), 'utf8');

  await log('INFO', account.region, `화면 스냅샷 저장: ${path.relative(process.cwd(), imagePath)}`);
}
