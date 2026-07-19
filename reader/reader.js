import { chromium } from "playwright";
import axios from "axios";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(__dirname, "config.json");
const PROFILE_PATH = path.join(__dirname, "chrome_profile_ntc_live");

const RIDER_PAGE_URL =
  "https://notouch.cc/admin?vendor=cbfcb934-6e54-42fe-8b18-c7d98cb17ca3&branch=1613130c-2206-4fbc-b815-c0f404b4a5a6";

const REGIONS = [
  "강남중앙1",
  "강남중앙2",
  "강남서초중앙",
  "강남남중앙"
];

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`config.json 파일이 없습니다: ${CONFIG_PATH}`);
  }

  const config = JSON.parse(
    fs.readFileSync(CONFIG_PATH, "utf-8")
  );

  if (!config.apiUrl) {
    throw new Error("config.json에 apiUrl이 없습니다.");
  }

  if (!config.ingestKey) {
    throw new Error("config.json에 ingestKey가 없습니다.");
  }

  return {
    apiUrl: config.apiUrl,
    ingestKey: config.ingestKey,
    syncSeconds: Number(config.syncSeconds) || 30
  };
}

function toNumber(value) {
  const normalized = String(value ?? "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(/건/g, "")
    .trim();

  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(value) {
  const status = String(value ?? "").trim();

  if (status.includes("배달")) {
    return "배달중";
  }

  if (status.includes("대기")) {
    return "대기중";
  }

  if (status.includes("오프라인")) {
    return "오프라인";
  }

  return status || "오프라인";
}

async function findRegionSelect(page) {
  const regionSelect = page.locator("select:visible").first();

  await regionSelect.waitFor({
    state: "visible",
    timeout: 30000
  });

  return regionSelect;
}

/**
 * 현재 선택한 권역의 실제 기사현황 표만 찾는다.
 *
 * 기존 table tbody는 페이지 안에서 2개가 발견되어
 * strict mode violation 오류가 발생했다.
 */
async function getRiderTable(page, region) {
  // 노터치CC에는 데스크톱/모바일용 표가 함께 존재할 수 있다.
  // 접근성 이름 대신 실제로 보이는 표 중 현재 권역과 기사 컬럼이 있는 표를 선택한다.
  const visibleTables = page.locator("table:visible");
  const count = await visibleTables.count();

  for (let index = 0; index < count; index += 1) {
    const table = visibleTables.nth(index);
    const text = await table.innerText().catch(() => "");

    if (
      text.includes(region) &&
      text.includes("이름") &&
      text.includes("상태") &&
      text.includes("완료")
    ) {
      return table;
    }
  }

  // 권역명이 표 내부에 포함되지 않는 화면 구조를 위한 보조 탐색
  for (let index = 0; index < count; index += 1) {
    const table = visibleTables.nth(index);
    const text = await table.innerText().catch(() => "");

    if (
      text.includes("이름") &&
      text.includes("상태") &&
      text.includes("거절") &&
      text.includes("취소") &&
      text.includes("완료")
    ) {
      return table;
    }
  }

  throw new Error(`${region} 기사현황 표를 찾지 못했습니다.`);
}

async function clickRefreshButton(page) {
  /*
   * 화면의 공유 버튼 바로 왼쪽에 있는 새로고침 버튼을 클릭한다.
   */
  const shareButton = page
    .getByRole("button", { name: /공유/ })
    .first();

  await shareButton.waitFor({
    state: "visible",
    timeout: 15000
  });

  const refreshButton = shareButton.locator(
    "xpath=preceding-sibling::button[1]"
  );

  if ((await refreshButton.count()) > 0) {
    await refreshButton.click();
    return;
  }

  /*
   * 위 방식으로 찾지 못한 경우를 위한 보조 선택자
   */
  const namedRefreshButton = page
    .locator(
      'button[aria-label*="새로"], button[title*="새로"], button[aria-label*="refresh" i]'
    )
    .filter({ visible: true })
    .first();

  if ((await namedRefreshButton.count()) > 0) {
    await namedRefreshButton.click();
    return;
  }

  throw new Error("공유 버튼 옆 새로고침 버튼을 찾지 못했습니다.");
}

async function waitForTableReady(page, region) {
  const table = await getRiderTable(page, region);
  const tbody = table.locator("tbody");

  await tbody.waitFor({
    state: "visible",
    timeout: 30000
  });

  /*
   * 표만 AJAX 방식으로 갱신되므로 로딩이 끝날 시간을 확보한다.
   */
  await page.waitForTimeout(1800);

  return table;
}

async function refreshRiderTable(page, region) {
  console.log(`[${region}] 새로고침 버튼 클릭...`);

  await clickRefreshButton(page);
  await waitForTableReady(page, region);
}

async function parseRiderTable(page, region) {
  const table = await getRiderTable(page, region);
  const rows = table.locator("tbody tr");

  const rowCount = await rows.count();
  const riders = [];

  for (
    let rowIndex = 0;
    rowIndex < rowCount;
    rowIndex += 1
  ) {
    const cells = rows.nth(rowIndex).locator("td");
    const cellCount = await cells.count();

    if (cellCount < 8) {
      continue;
    }

    const values = [];

    for (
      let cellIndex = 0;
      cellIndex < 8;
      cellIndex += 1
    ) {
      const value = await cells
        .nth(cellIndex)
        .innerText()
        .catch(() => "");

      values.push(value.trim());
    }

    const name = values[0];

    if (!name) {
      continue;
    }

riders.push({
  name,
  status: normalizeStatus(values[1]),
  reject: toNumber(values[2]),
  cancel: toNumber(values[3]),

  // Worker 호환
  complete: toNumber(values[4]),
  completed: toNumber(values[4]),

  lunchPeak: toNumber(values[5]),
  lunch: toNumber(values[5]),

  dinnerPeak: toNumber(values[6]),
  dinner: toNumber(values[6]),

  nonPeak: toNumber(values[7])
});
  }

  return riders;
}

async function readRiders(page, region) {
  const regionSelect = await findRegionSelect(page);

  console.log(`[${region}] 권역 선택 중...`);

  await regionSelect.selectOption({
    label: region
  });

  /*
   * 권역 선택 후 제목과 표가 해당 권역으로 바뀔 때까지 대기
   */
  await getRiderTable(page, region);

  console.log(`[${region}] 최신 데이터 새로고침 중...`);

  await refreshRiderTable(page, region);

  console.log(`[${region}] 기사표 읽는 중...`);

  return parseRiderTable(page, region);
}

async function uploadRegion(config, region, riders) {
  const payload = {
    region,
    riders,
    riderCount: riders.length,

    deliveringCount: riders.filter(
      (rider) => rider.status === "배달중"
    ).length,

    waitingCount: riders.filter(
      (rider) => rider.status === "대기중"
    ).length,

    offlineCount: riders.filter(
      (rider) => rider.status === "오프라인"
    ).length,

    collectedAt: new Date().toISOString()
  };

  const response = await axios.post(
    config.apiUrl,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
        "X-NTC-INGEST-KEY": config.ingestKey
      },

      timeout: 15000,
      validateStatus: () => true
    }
  );

  if (response.status < 200 || response.status >= 300) {
    const responseBody =
      typeof response.data === "string"
        ? response.data
        : JSON.stringify(response.data);

    throw new Error(
      `업로드 실패 HTTP ${response.status}: ${responseBody}`
    );
  }

  return response.status;
}

async function collectRegion(config, page, region) {
  try {
    const riders = await readRiders(page, region);

    console.log(
      `[${region}] 기사 ${riders.length}명 읽기 완료`
    );

    if (riders.length === 0) {
      throw new Error(
        "기사 데이터가 0명이라 안전을 위해 업로드하지 않습니다."
      );
    }

    console.log(`[${region}] 노터치센트럴 전송 중...`);

    const status = await uploadRegion(
      config,
      region,
      riders
    );

    console.log(
      `[${region}] 전송 완료 HTTP ${status}`
    );

    return {
      region,
      success: true,
      riderCount: riders.length
    };
  } catch (error) {
    const message =
      error.response?.data?.error ??
      error.response?.data?.message ??
      error.message ??
      String(error);

    console.error(`[${region}] 처리 실패: ${message}`);

    return {
      region,
      success: false,
      riderCount: 0,
      error: message
    };
  }
}

async function collectAllRegions(config, page) {
  const startedAt = Date.now();
  const results = [];

  console.log("\n====================================");
  console.log(
    `4권역 수집 시작: ${new Date().toLocaleString("ko-KR")}`
  );
  console.log("====================================");

  for (const region of REGIONS) {
    const result = await collectRegion(
      config,
      page,
      region
    );

    results.push(result);

    await page.waitForTimeout(500);
  }

  const successCount = results.filter(
    (result) => result.success
  ).length;

  const elapsedSeconds = (
    (Date.now() - startedAt) /
    1000
  ).toFixed(1);

  console.log("\n====================================");
  console.log(
    `수집 완료: ${successCount}/${REGIONS.length}권역 성공`
  );
  console.log(`소요 시간: ${elapsedSeconds}초`);
  console.log("====================================");

  return results;
}

async function ensureRiderPage(page) {
  await page.goto(RIDER_PAGE_URL, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  await findRegionSelect(page);

  console.log("기사현황 페이지 접속 완료");
}

async function main() {
  const config = loadConfig();

  console.log("====================================");
  console.log(" NoTouchCentral Reader 0.7");
  console.log(" 기사현황 4권역 실시간 수집");
  console.log("====================================");
  console.log(`전송 주소: ${config.apiUrl}`);
  console.log(`반복 주기: ${config.syncSeconds}초`);

  const context =
    await chromium.launchPersistentContext(
      PROFILE_PATH,
      {
        headless: false,
        viewport: null,
        args: [
          "--start-maximized",
          "--disable-blink-features=AutomationControlled"
        ]
      }
    );

  const existingPages = context.pages();

  const page =
    existingPages[0] ?? (await context.newPage());

  page.setDefaultTimeout(30000);

  await ensureRiderPage(page);

  while (true) {
    await collectAllRegions(config, page);

    console.log(
      `\n${config.syncSeconds}초 후 다시 수집합니다.`
    );

    await sleep(config.syncSeconds * 1000);
  }
}

main().catch((error) => {
  console.error("\nReader 실행 오류");
  console.error(error);

  process.exitCode = 1;
});