import { log } from './logger.js';

const HOME_TEXT = /^홈$/;

async function firstVisible(locator) {
  const count = await locator.count();
  for (let i = 0; i < count; i += 1) {
    const item = locator.nth(i);
    if (await item.isVisible().catch(() => false)) return item;
  }
  return null;
}

async function pageLooksLikeAdmin(page) {
  const url = page.url();
  if (/\/admin(?:[/?#]|$)/i.test(url)) return true;
  const text = await page.locator('body').innerText().catch(() => '');
  return /기사현황/.test(text) && /회원관리/.test(text) && /벤더/.test(text);
}

async function pageLooksLikeHome(page) {
  const url = page.url();
  if (!/\/admin(?:[/?#]|$)/i.test(url) && !/\/login(?:[/?#]|$)/i.test(url)) return true;

  const text = await page.locator('body').innerText().catch(() => '');
  // 관제 홈에서 확인 가능한 대표 문구. 일부만 있어도 홈으로 판단한다.
  return /세트|팀미션|리워드|관제/.test(text) && !/기사현황\s*[·-]/.test(text);
}

async function clickBottomHome(page) {
  // 가장 안전한 우선순위: 하단 nav 안의 링크/버튼 중 텍스트가 정확히 "홈"인 요소.
  const selectors = [
    'nav a:has-text("홈")',
    'nav button:has-text("홈")',
    'footer a:has-text("홈")',
    'footer button:has-text("홈")',
    'a:has-text("홈")',
    'button:has-text("홈")',
    '[role="button"]:has-text("홈")',
  ];

  for (const selector of selectors) {
    const candidates = page.locator(selector);
    const count = await candidates.count();
    for (let i = 0; i < count; i += 1) {
      const candidate = candidates.nth(i);
      if (!(await candidate.isVisible().catch(() => false))) continue;
      const text = (await candidate.innerText().catch(() => '')).trim();
      if (!HOME_TEXT.test(text)) continue;

      await candidate.scrollIntoViewIfNeeded().catch(() => undefined);
      await candidate.click({ timeout: 8_000 });
      return true;
    }
  }

  // 아이콘과 글자가 분리된 구조 대응: 정확한 "홈" 텍스트의 부모 클릭.
  const exactText = await firstVisible(page.getByText(HOME_TEXT, { exact: true }));
  if (exactText) {
    const clickable = exactText.locator('xpath=ancestor-or-self::a[1] | ancestor-or-self::button[1] | ancestor-or-self::*[@role="button"][1]');
    if (await clickable.count()) {
      await clickable.first().click({ timeout: 8_000 });
      return true;
    }
    await exactText.click({ timeout: 8_000 });
    return true;
  }

  return false;
}

export async function navigateToHome(page, account) {
  if (page.isClosed()) throw new Error('Reader 브라우저 페이지가 닫혔습니다.');

  if (await pageLooksLikeHome(page)) {
    await log('INFO', account.region, '관제 홈 화면 유지 확인');
    return;
  }

  if (!(await pageLooksLikeAdmin(page))) {
    await log('WARN', account.region, `현재 화면에서 홈 이동을 시도합니다: ${page.url()}`);
  }

  const clicked = await clickBottomHome(page);
  if (!clicked) {
    throw new Error('하단 홈 버튼을 찾지 못했습니다. 홈 화면 캡처가 필요합니다.');
  }

  await Promise.race([
    page.waitForURL((url) => !/\/admin(?:[/?#]|$)/i.test(url.pathname), { timeout: 12_000 }),
    page.waitForTimeout(12_000),
  ]).catch(() => undefined);
  await page.waitForLoadState('domcontentloaded', { timeout: 8_000 }).catch(() => undefined);
  await page.waitForTimeout(1_000);

  if (await pageLooksLikeAdmin(page)) {
    throw new Error('홈 버튼을 눌렀지만 기사현황 화면에 그대로 있습니다.');
  }

  await log('INFO', account.region, `관제 홈 이동 완료: ${page.url()}`);
}
