import fs from 'node:fs/promises';
import path from 'node:path';

const logDirectory = path.resolve('reader/logs');

function line(level, region, message) {
  return `${new Date().toISOString()} [${level}] [${region}] ${message}`;
}

export async function log(level, region, message) {
  const output = line(level, region, message);
  console.log(output);
  await fs.mkdir(logDirectory, { recursive: true });
  await fs.appendFile(path.join(logDirectory, 'reader.log'), `${output}\n`, 'utf8');
}
