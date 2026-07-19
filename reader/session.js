import path from 'node:path';
import { chromium } from 'playwright';
import { NOTOUCH_BASE_URL, READER_OPTIONS } from './config.js';
import { log } from './logger.js';

const LOGIN_TEXT = /로그인|sign\s*in/i;

async function firstVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) return locator;
  }
  return null;
}

async function isLoginPage(page) {
  if (/\/login(?:[/?#]|$)/i.test(page.url())) return true;

  const password = await firstVisible(page, [
    'input[type="password"]',
    'input[name*="password" i]',
    'input[placeholder*="비밀번호"]',
  ]);
  if (password) return true;

  const bodyText = await page.locator('body').innerText().catch(() => '');
  return LOGIN_TEXT.test(bodyText) && /비밀번호|아이디|전화번호/.test(bodyText);
}

async function waitForLoginResult(page) {
  await Promise.race([
    page.waitForURL((url) => !/\/login(?:[/?#]|$)/i.test(url.pathname), { timeout: 12_000 }),
    page.waitForTimeout(12_000),
  ]).catch(() => undefined);
  await page.waitForLoadState('domcontentloaded', { timeout: 8_000 }).catch(() => undefined);
  await page.waitForTimeout(1_000);
}

async function submitLogin(page, username, password) {
  // 1순위: 비밀번호 입력창이 속한 form을 직접 제출
  const form = password.locator('xpath=ancestor::form[1]');
  if (await form.count()) {
    const submit = form.locator('button[type="submit"], input[type="submit"]').first();
    if (await submit.isVisible().catch(() => false)) {
      await submit.scrollIntoViewIfNeeded();
      await submit.click();
      return;
    }
  }

  // 2순위: 입력 영역 아래쪽의 실제 로그인 버튼 선택
  const passwordBox = await password.boundingBox();
  const candidates = page.locator('button:visible, [role="button"]:visible, input[type="submit"]:visible');
  const count = await candidates.count();
  let selected = null;

  for (let i = 0; i < count; i += 1) {
    const candidate = candidates.nth(i);
    const text = ((await candidate.innerText().catch(() => '')) || (await candidate.getAttribute('value').catch(() => '')) || '').trim();
    if (!/^로그인$/i.test(text)) continue;

    const box = await candidate.boundingBox();
    if (!box) continue;
    if (!passwordBox || box.y > passwordBox.y) selected = candidate;
  }

  if (selected) {
    await selected.scrollIntoViewIfNeeded();
    await selected.click();
    return;
  }

  // 3순위: 로그인 폼의 일반 동작대로 Enter 제출
  await password.press('Enter');
}

async function fillLogin(page, account) {
  const username = await firstVisible(page, [
    'input[type="tel"]',
    'input[name*="phone" i]',
    'input[name*="user" i]',
    'input[name*="login" i]',
    'input[autocomplete="username"]',
    'input[placeholder*="아이디"]',
    'input[placeholder*="전화번호"]',
  ]);
  const password = await firstVisible(page, [
    'input[type="password"]',
    'input[name*="password" i]',
    'input[autocomplete="current-password"]',
    'input[placeholder*="비밀번호"]',
  ]);

  if (!username || !password) {
    throw new Error('로그인 입력창을 찾지 못했습니다. 로그인 화면 캡처가 필요합니다.');
  }

  await username.fill(account.username);
  await password.fill(account.password);
  await submitLogin(page, username, password);
  await waitForLoginResult(page);

  if (await isLoginPage(page)) {
    throw new Error('로그인 버튼 제출 후에도 로그인 화면입니다.');
  }
}

export async function openReaderSession(account) {
  const userDataDir = path.resolve('reader/profiles', account.key);
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: READER_OPTIONS.headless,
    slowMo: READER_OPTIONS.slowMo,
    viewport: { width: 1440, height: 960 },
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  });

  context.setDefaultNavigationTimeout(READER_OPTIONS.navigationTimeoutMs);
  const pages = context.pages();
  const page = pages[0] ?? await context.newPage();

  await ensureLoggedIn(page, account);
  return { account, context, page, busy: false };
}

export async function ensureLoggedIn(page, account) {
  if (page.isClosed()) throw new Error('Reader 브라우저 페이지가 닫혔습니다.');

  if (page.url() === 'about:blank') {
    await page.goto(NOTOUCH_BASE_URL, { waitUntil: 'domcontentloaded' });
  } else if (await isLoginPage(page)) {
    // 로그인 화면에서는 reload하지 않고 즉시 입력한다.
  } else {
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(async () => {
      await page.goto(NOTOUCH_BASE_URL, { waitUntil: 'domcontentloaded' });
    });
  }

  if (await isLoginPage(page)) {
    await log('WARN', account.region, '세션이 없어 자동 로그인을 시도합니다.');
    await fillLogin(page, account);
    await log('INFO', account.region, '자동 로그인 완료');
  } else {
    await log('INFO', account.region, '기존 로그인 세션 유지 확인');
  }
}
