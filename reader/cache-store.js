import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CACHE_DIR = path.resolve('reader', 'cache');

async function ensureCacheDir() {
  await mkdir(CACHE_DIR, { recursive: true });
}

export async function readJson(name, fallback = null) {
  await ensureCacheDir();
  try {
    const raw = await readFile(path.join(CACHE_DIR, name), 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function writeJson(name, value) {
  await ensureCacheDir();
  const target = path.join(CACHE_DIR, name);
  const temp = `${target}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temp, target);
  return target;
}
