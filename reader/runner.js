import { READER_ACCOUNTS, READER_OPTIONS } from './config.js';
import { collectHome, rebuildCombinedCache } from './collector.js';
import { log } from './logger.js';
import { navigateToHome } from './navigation.js';
import { ensureLoggedIn, openReaderSession } from './session.js';
import { savePageSnapshot } from './snapshot.js';

const sessions = [];
let shuttingDown = false;

async function closeAll() {
  if (shuttingDown) return;
  shuttingDown = true;
  await Promise.allSettled(sessions.map(({ context }) => context.close()));
}

process.on('SIGINT', async () => {
  console.log('\nReader를 안전하게 종료합니다...');
  await closeAll();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await closeAll();
  process.exit(0);
});

async function runExclusive(session, taskName, task) {
  if (session.busy || shuttingDown) return;
  session.busy = true;
  try {
    await task();
  } catch (error) {
    await log('ERROR', session.account.region, `${taskName} 실패: ${error.message}`);
  } finally {
    session.busy = false;
  }
}

async function keepSessionReady(session) {
  await ensureLoggedIn(session.page, session.account);
  await navigateToHome(session.page, session.account);
}

async function startAccount(account) {
  const session = await openReaderSession(account);
  sessions.push(session);

  await runExclusive(session, '초기 홈 이동', async () => {
    await navigateToHome(session.page, account);
    await savePageSnapshot(session);
    await collectHome(session);
    await rebuildCombinedCache(sessions);
  });

  setInterval(() => {
    void runExclusive(session, '세션 확인', async () => {
      await keepSessionReady(session);
    });
  }, READER_OPTIONS.healthCheckIntervalMs);

  setInterval(() => {
    void runExclusive(session, '스냅샷 저장', async () => {
      await keepSessionReady(session);
      await savePageSnapshot(session);
      await collectHome(session);
      await rebuildCombinedCache(sessions);
    });
  }, READER_OPTIONS.snapshotIntervalMs);
}

async function main() {
  await log('INFO', 'SYSTEM', '4개 권역 독립 Reader 시작');
  for (const account of READER_ACCOUNTS) {
    try {
      await startAccount(account);
    } catch (error) {
      await log('ERROR', account.region, `Reader 시작 실패: ${error.stack || error.message}`);
    }
  }

  if (sessions.length === 0) {
    throw new Error('실행된 Reader가 없습니다.');
  }

  await log('INFO', 'SYSTEM', `${sessions.length}개 Reader 실행 중`);
  await new Promise(() => {});
}

main().catch(async (error) => {
  await log('ERROR', 'SYSTEM', error.stack || error.message);
  await closeAll();
  process.exit(1);
});
