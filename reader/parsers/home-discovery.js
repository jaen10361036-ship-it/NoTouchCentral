function cleanText(value) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function unique(values) {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

export async function inspectHome(page, account) {
  const capturedAt = new Date().toISOString();
  const data = await page.evaluate(() => {
    const visible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };

    const textOf = (el) => (el?.innerText || el?.textContent || '').trim();
    const select = (selector, limit = 100) => [...document.querySelectorAll(selector)]
      .filter(visible)
      .slice(0, limit)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: textOf(el),
        className: typeof el.className === 'string' ? el.className : '',
        ariaLabel: el.getAttribute('aria-label') || '',
        role: el.getAttribute('role') || '',
      }));

    const candidateSelector = [
      'main section', 'main article', 'main [class*="card"]',
      'section', 'article', '[class*="card"]', '[class*="mission"]',
      '[class*="reward"]', '[class*="set"]'
    ].join(',');

    return {
      title: document.title,
      bodyText: textOf(document.body),
      headings: select('h1,h2,h3,h4,h5,h6', 80),
      buttons: select('button,a,[role="button"]', 120),
      candidates: select(candidateSelector, 160),
    };
  });

  const candidates = data.candidates
    .map((item) => ({ ...item, text: cleanText(item.text) }))
    .filter((item) => item.text.length >= 2 && item.text.length <= 1500);

  const missionCandidates = candidates.filter((item) => /미션|모닝|런치|디너|포스트/i.test(item.text));
  const setCandidates = candidates.filter((item) => /세트|SET|명당/i.test(item.text));
  const rewardCandidates = candidates.filter((item) => /리워드|GOLD|BLACK|PURPLE|BLUE|GREEN|YELLOW/i.test(item.text));

  return {
    schemaVersion: 1,
    accountKey: account.key,
    region: account.region,
    capturedAt,
    url: page.url(),
    title: cleanText(data.title),
    bodyText: cleanText(data.bodyText),
    headings: unique(data.headings.map((item) => item.text)),
    buttons: unique(data.buttons.map((item) => item.text)).slice(0, 120),
    candidates,
    detected: {
      set: setCandidates,
      mission: missionCandidates,
      reward: rewardCandidates,
    },
  };
}
