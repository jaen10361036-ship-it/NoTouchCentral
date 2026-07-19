import { readJson, writeJson } from './cache-store.js';

const RETENTION_MS = 60 * 60 * 1000;
const CACHE_FILE = 'missions.json';

function missionId(region, text) {
  return `${region}::${text.replace(/\s+/g, ' ').trim()}`;
}

export async function updateMissionRetention(homeSnapshots) {
  const now = Date.now();
  const previous = await readJson(CACHE_FILE, { schemaVersion: 1, updatedAt: null, missions: [] });
  const previousById = new Map((previous.missions || []).map((item) => [item.id, item]));
  const current = [];

  for (const snapshot of homeSnapshots) {
    for (const candidate of snapshot.detected?.mission || []) {
      const text = candidate.text.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const id = missionId(snapshot.region, text);
      current.push({
        id,
        region: snapshot.region,
        text,
        source: 'live',
        firstSeenAt: previousById.get(id)?.firstSeenAt || snapshot.capturedAt,
        lastSeenAt: snapshot.capturedAt,
        retainUntil: null,
        isRetained: false,
      });
      previousById.delete(id);
    }
  }

  for (const old of previousById.values()) {
    const lastSeenMs = Date.parse(old.lastSeenAt || old.firstSeenAt || 0);
    const retainUntilMs = Number.isFinite(lastSeenMs) ? lastSeenMs + RETENTION_MS : 0;
    if (retainUntilMs > now) {
      current.push({
        ...old,
        source: 'retained',
        retainUntil: new Date(retainUntilMs).toISOString(),
        isRetained: true,
      });
    }
  }

  current.sort((a, b) => a.region.localeCompare(b.region, 'ko') || a.text.localeCompare(b.text, 'ko'));
  const result = {
    schemaVersion: 1,
    retentionMinutes: 60,
    updatedAt: new Date(now).toISOString(),
    missions: current,
  };
  await writeJson(CACHE_FILE, result);
  return result;
}
