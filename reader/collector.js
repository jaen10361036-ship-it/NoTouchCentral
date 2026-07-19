import { writeJson } from './cache-store.js';
import { log } from './logger.js';
import { updateMissionRetention } from './mission-retention.js';
import { inspectHome } from './parsers/home-discovery.js';

export async function collectHome(session) {
  const snapshot = await inspectHome(session.page, session.account);
  session.lastHomeSnapshot = snapshot;
  await writeJson(`home-${session.account.key}.json`, snapshot);
  await log(
    'INFO',
    session.account.region,
    `홈 구조 수집 완료 (세트 후보 ${snapshot.detected.set.length}, 팀미션 후보 ${snapshot.detected.mission.length}, 리워드 후보 ${snapshot.detected.reward.length})`,
  );
  return snapshot;
}

export async function rebuildCombinedCache(sessions) {
  const home = sessions.map((session) => session.lastHomeSnapshot).filter(Boolean);
  await writeJson('home-all.json', {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    regions: home,
  });
  await updateMissionRetention(home);
}
