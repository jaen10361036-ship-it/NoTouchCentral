const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

const normalizeUsername = (value) => String(value ?? "").trim().toLowerCase();
const normalizePhone = (value) => String(value ?? "").replace(/\D/g, "");
const ADMIN_ROLES = new Set(["BOSS/지사장", "총괄본부장", "운영실장", "운영팀장"]);
const ALLOWED_ROLES = new Set(["총괄본부장", "운영실장", "운영팀장", "강남총괄팀장", "강남중앙1 팀장", "강남중앙2 팀장", "강남서초중앙 팀장", "강남남중앙 팀장", "강남서부 팀장", "팀장"]);
const ALLOWED_REGIONS = new Set(["전권역 운영", "강남중앙1", "강남중앙2", "강남서초중앙", "강남남중앙", "강남서부", "권역없음(현장팀장)"]);

function bytesToBase64(bytes) { let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
function base64ToBytes(value) { const binary = atob(value); return Uint8Array.from(binary, (ch) => ch.charCodeAt(0)); }
function randomToken() { const bytes = crypto.getRandomValues(new Uint8Array(32)); return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""); }

async function derivePassword(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, keyMaterial, 256);
  return new Uint8Array(bits);
}
async function hashPassword(password) { const salt = crypto.getRandomValues(new Uint8Array(16)); const iterations = 100000; const hash = await derivePassword(password, salt, iterations); return `pbkdf2_sha256$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`; }
async function verifyPassword(password, storedHash) {
  try { const [algorithm, iterationValue, saltValue, expectedValue] = String(storedHash).split("$"); if (algorithm !== "pbkdf2_sha256") return false; const actual = await derivePassword(password, base64ToBytes(saltValue), Number(iterationValue)); const expected = base64ToBytes(expectedValue); if (actual.length !== expected.length) return false; let difference = 0; for (let i = 0; i < actual.length; i += 1) difference |= actual[i] ^ expected[i]; return difference === 0; } catch { return false; }
}

async function ensureTables(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '팀장', region TEXT DEFAULT '미배정', is_active INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_login DATETIME, phone TEXT)`).run();
  const info = await db.prepare("PRAGMA table_info(users)").all();
  const names = new Set((info.results ?? []).map((column) => column.name));
  if (!names.has("phone")) await db.prepare("ALTER TABLE users ADD COLUMN phone TEXT").run();
  if (!names.has("scheduled_start_time")) {
    await db.prepare("ALTER TABLE users ADD COLUMN scheduled_start_time TEXT DEFAULT '10:00'").run();
  }

  // Production safety migration:
  // the one-time bootstrap account uses username "boss" and must always remain BOSS.
  await db.prepare(`
    UPDATE users
    SET role = 'BOSS/지사장',
        region = '전권역 운영',
        is_active = 1
    WHERE lower(trim(username)) = 'boss'
  `).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`).run();
  await db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(Math.floor(Date.now() / 1000)).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    work_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '미출근',
    check_in DATETIME,
    check_out DATETIME,
    orders INTEGER,
    late INTEGER NOT NULL DEFAULT 0,
    absent INTEGER NOT NULL DEFAULT 0,
    approved_checkin INTEGER NOT NULL DEFAULT 0,
    approved_by INTEGER,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, work_date),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`).run();
  const attendanceInfo = await db.prepare("PRAGMA table_info(attendance)").all();
  const attendanceNames = new Set((attendanceInfo.results ?? []).map((column) => column.name));
  if (!attendanceNames.has("late_minutes")) {
    await db.prepare("ALTER TABLE attendance ADD COLUMN late_minutes INTEGER NOT NULL DEFAULT 0").run();
  }
  await db.prepare(`CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    leave_date TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '일반 휴무',
    memo TEXT,
    status TEXT NOT NULL DEFAULT '승인 대기',
    approved_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, leave_date),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS riders_live (
    region TEXT NOT NULL,
    rider_key TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '오프라인',
    online INTEGER NOT NULL DEFAULT 0,
    rejected REAL NOT NULL DEFAULT 0,
    canceled REAL NOT NULL DEFAULT 0,
    completed REAL NOT NULL DEFAULT 0,
    lunch REAL NOT NULL DEFAULT 0,
    dinner REAL NOT NULL DEFAULT 0,
    non_peak REAL NOT NULL DEFAULT 0,
    source_updated_at TEXT,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(region, rider_key)
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS rider_sync_state (
    region TEXT PRIMARY KEY,
    rider_count INTEGER NOT NULL DEFAULT 0,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS operational_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER
  )`).run();
  const defaultOperationalSettings = {
    set_count_gangnam_central_1: "6",
    set_count_gangnam_central_2: "6",
    set_count_gangnam_seocho_central: "8",
    set_count_gangnam_nam_central: "6",
    reader_interval_seconds: "30",
    mission_keep_minutes: "60",
  };
  for (const [key, value] of Object.entries(defaultOperationalSettings)) {
    await db.prepare(`INSERT OR IGNORE INTO operational_settings (key, value) VALUES (?, ?)`).bind(key, value).run();
  }

  await db.prepare(`CREATE TABLE IF NOT EXISTS live_locations (
    user_id INTEGER PRIMARY KEY,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy REAL,
    heading REAL,
    speed REAL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`).run();
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    phone: user.phone,
    role: user.role,
    region: user.region,
    scheduled_start_time:
      user.role === "BOSS/지사장"
        ? null
        : (user.scheduled_start_time || "10:00"),
  };
}
async function createSession(db, userId, remember = true) { const token = randomToken(); const ttl = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12; const expiresAt = Math.floor(Date.now() / 1000) + ttl; await db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").bind(token, userId, expiresAt).run(); return token; }
function bearerToken(request) { const auth = request.headers.get("Authorization") || ""; return auth.startsWith("Bearer ") ? auth.slice(7).trim() : ""; }
async function authenticate(request, env) {
  const token = bearerToken(request); if (!token) return null;
  const row = await env.DB.prepare(`SELECT u.id, u.username, u.name, u.phone, u.role, u.region, u.scheduled_start_time, u.is_active, s.token FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ? LIMIT 1`).bind(token, Math.floor(Date.now()/1000)).first();
  if (!row || Number(row.is_active) !== 1) return null; return row;
}
async function requireAuth(request, env) { const user = await authenticate(request, env); return user ? { user } : { response: json({ message: "로그인이 필요합니다." }, 401) }; }
async function requireAdmin(request, env) { const auth = await requireAuth(request, env); if (auth.response) return auth; if (!ADMIN_ROLES.has(auth.user.role)) return { response: json({ message: "관리자 관리 권한이 없습니다." }, 403) }; return auth; }
async function requireBoss(request, env) { const auth = await requireAuth(request, env); if (auth.response) return auth; if (auth.user.role !== "BOSS/지사장") return { response: json({ message: "BOSS 전용 권한입니다." }, 403) }; return auth; }

async function requireFreshLocation(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.response) return auth;
  const location = await env.DB.prepare(`
    SELECT user_id FROM live_locations
    WHERE user_id = ? AND datetime(updated_at) >= datetime('now', '-2 minutes')
    LIMIT 1
  `).bind(auth.user.id).first();
  if (!location) {
    return { response: json({ code: "LOCATION_REQUIRED", message: "위치 권한과 현재 위치 확인이 필요합니다." }, 428) };
  }
  return auth;
}


function normalizeRiderRegion(value) {
  const raw = String(value ?? '').trim().replace(/\s+/g, '');
  if (raw === '남중앙' || raw === '강남남중앙') return '강남남중앙';
  if (raw === '강남서초중앙' || raw === '서초중앙') return '강남서초중앙';
  if (raw === '강남중앙1' || raw === '중앙1') return '강남중앙1';
  if (raw === '강남중앙2' || raw === '중앙2') return '강남중앙2';
  return String(value ?? '').trim();
}
function riderNumber(value) {
  const number = Number(String(value ?? 0).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? number : 0;
}
function normalizeRiderStatus(value, online) {
  const text = String(value ?? '').trim();
  if (!online && !/배달|운행|온라인|대기/.test(text)) return '오프라인';
  if (/배달|운행/.test(text)) return '배달중';
  if (/대기|온라인/.test(text) || online) return '대기중';
  return '오프라인';
}
async function ingestReaderRiders(request, env) {
  const configuredKey = String(env.NTC_INGEST_KEY ?? '').trim();
  const suppliedKey = String(request.headers.get('X-NTC-Ingest-Key') ?? '').trim();
  if (!configuredKey || suppliedKey !== configuredKey) return json({ message: '수집 인증키가 올바르지 않습니다.' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ message: 'JSON 형식이 올바르지 않습니다.' }, 400); }
  const region = normalizeRiderRegion(body.region);
  const allowed = new Set(['강남중앙1','강남중앙2','강남서초중앙','강남남중앙']);
  if (!allowed.has(region)) return json({ message: '지원하지 않는 권역입니다.' }, 400);
  const riders = Array.isArray(body.riders) ? body.riders : [];
  const receivedAt = new Date().toISOString();
  const statements = [env.DB.prepare('DELETE FROM riders_live WHERE region = ?').bind(region)];
  riders.forEach((item, index) => {
    const name = String(item?.name ?? item?.기사명 ?? '').trim();
    if (!name) return;
    const riderKey = String(item?.id ?? item?.rider_id ?? item?.key ?? `${name}-${index}`).trim();
    const online = Boolean(item?.online) || /배달|운행|온라인|대기/.test(String(item?.status ?? item?.상태 ?? ''));
    const status = normalizeRiderStatus(item?.status ?? item?.상태, online);
    statements.push(env.DB.prepare(`INSERT INTO riders_live (region,rider_key,name,status,online,rejected,canceled,completed,lunch,dinner,non_peak,source_updated_at,received_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(region,riderKey,name,status,online?1:0,riderNumber(item?.rejected ?? item?.reject ?? item?.거절),riderNumber(item?.canceled ?? item?.cancel ?? item?.취소),riderNumber(item?.completed ?? item?.done ?? item?.완료),riderNumber(item?.lunch ?? item?.점심피크 ?? item?.점심),riderNumber(item?.dinner ?? item?.저녁피크 ?? item?.저녁),riderNumber(item?.nonPeak ?? item?.non_peak ?? item?.논피크),String(item?.updated_at ?? body.updated_at ?? receivedAt),receivedAt));
  });
  statements.push(env.DB.prepare(`INSERT INTO rider_sync_state (region,rider_count,received_at) VALUES (?,?,?) ON CONFLICT(region) DO UPDATE SET rider_count=excluded.rider_count, received_at=excluded.received_at`).bind(region,riders.length,receivedAt));
  await env.DB.batch(statements);
  return json({ ok:true, region, received:riders.length, receivedAt });
}
async function listRiders(request, env) {
  const auth = await requireAuth(request, env); if (auth.response) return auth.response;
  const url = new URL(request.url);
  const region = normalizeRiderRegion(url.searchParams.get('region') || '');
  const where = region ? 'WHERE region = ?' : '';
  const query = `SELECT region,rider_key AS id,name,status,online,rejected,canceled,completed,lunch,dinner,non_peak AS nonPeak,source_updated_at,received_at FROM riders_live ${where} ORDER BY CASE status WHEN '배달중' THEN 0 WHEN '대기중' THEN 1 ELSE 2 END, completed DESC, name ASC`;
  const result = region ? await env.DB.prepare(query).bind(region).all() : await env.DB.prepare(query).all();
  const sync = await env.DB.prepare('SELECT region,rider_count,received_at FROM rider_sync_state ORDER BY region').all();
  return json({ ok:true, riders: result.results ?? [], sync: sync.results ?? [] });
}

async function bootstrapStatus(env) { await ensureTables(env.DB); const boss = await env.DB.prepare("SELECT id FROM users WHERE role = 'BOSS/지사장' LIMIT 1").first(); return json({ ok: true, needsBootstrap: !boss }); }
async function bootstrapCreate(request, env) {
  await ensureTables(env.DB);
  const existingBoss = await env.DB.prepare("SELECT id FROM users WHERE role = 'BOSS/지사장' LIMIT 1").first();
  if (existingBoss) return json({ message: "BOSS 계정이 이미 존재합니다." }, 409);
  const body = await request.json(); const name = String(body.name ?? "").trim(); const phone = normalizePhone(body.phone); const username = normalizeUsername(body.username); const password = String(body.password ?? "");
  if (name.length < 2) return json({ field: "name", message: "이름을 2자 이상 입력해주세요." }, 400);
  if (!/^01[016789]\d{7,8}$/.test(phone)) return json({ field: "phone", message: "휴대전화 번호를 확인해주세요." }, 400);
  if (!/^[a-z0-9_-]{4,20}$/.test(username)) return json({ field: "username", message: "아이디 형식을 확인해주세요." }, 400);
  if (password.length < 8) return json({ field: "password", message: "비밀번호를 8자 이상 입력해주세요." }, 400);
  const duplicate = await env.DB.prepare("SELECT id FROM users WHERE username = ? OR phone = ? LIMIT 1").bind(username, phone).first();
  if (duplicate) return json({ message: "이미 사용 중인 아이디 또는 휴대전화 번호입니다." }, 409);
  const result = await env.DB.prepare(`INSERT INTO users (username,password_hash,name,role,region,is_active,created_at,phone) VALUES (?, ?, ?, 'BOSS/지사장', '전권역 운영', 1, CURRENT_TIMESTAMP, ?)`).bind(username, await hashPassword(password), name, phone).run();
  const user = await env.DB.prepare("SELECT id, username, name, phone, role, region, scheduled_start_time FROM users WHERE id = ?").bind(result.meta.last_row_id).first();
  const token = await createSession(env.DB, user.id, true); return json({ ok: true, token, user: publicUser(user) }, 201);
}

async function signup(request, env) {
  await ensureTables(env.DB); const body = await request.json(); const name = String(body.name ?? "").trim(); const phone = normalizePhone(body.phone); const username = normalizeUsername(body.username); const password = String(body.password ?? "");
  if (name.length < 2) return json({ field: "name", message: "이름을 2자 이상 입력해주세요." }, 400); if (!/^01[016789]\d{7,8}$/.test(phone)) return json({ field: "phone", message: "휴대전화 번호를 확인해주세요." }, 400); if (!/^[a-z0-9_-]{4,20}$/.test(username)) return json({ field: "username", message: "아이디 형식을 확인해주세요." }, 400); if (password.length < 8) return json({ field: "password", message: "비밀번호를 8자 이상 입력해주세요." }, 400);
  const existing = await env.DB.prepare("SELECT username, phone FROM users WHERE username = ? OR phone = ? LIMIT 1").bind(username, phone).first(); if (existing?.username === username) return json({ field: "username", message: "이미 사용 중인 아이디입니다." }, 409); if (existing?.phone === phone) return json({ field: "phone", message: "이미 가입 신청된 휴대전화 번호입니다." }, 409);
  const result = await env.DB.prepare(`INSERT INTO users (username,password_hash,name,role,region,is_active,created_at,phone) VALUES (?, ?, ?, '팀장', '미배정', 0, CURRENT_TIMESTAMP, ?)`).bind(username, await hashPassword(password), name, phone).run(); return json({ ok: true, status: "pending", userId: result.meta?.last_row_id ?? null, message: "가입 신청이 접수되었습니다." }, 201);
}
async function login(request, env) {
  await ensureTables(env.DB); const body = await request.json(); const username = normalizeUsername(body.username); const password = String(body.password ?? ""); const remember = Boolean(body.remember);
  const user = await env.DB.prepare("SELECT id,username,password_hash,name,phone,role,region,scheduled_start_time,is_active FROM users WHERE username = ? LIMIT 1").bind(username).first();
  if (!user || !(await verifyPassword(password, user.password_hash))) return json({ field: "loginPassword", message: "아이디 또는 비밀번호가 올바르지 않습니다." }, 401); if (Number(user.is_active) === 0) return json({ field: "loginPassword", message: "아직 최고관리자의 승인 대기 중입니다." }, 403); if (Number(user.is_active) === 2) return json({ field: "loginPassword", message: "사용이 정지된 계정입니다." }, 403);
  await env.DB.prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?").bind(user.id).run(); const token = await createSession(env.DB, user.id, remember); return json({ ok: true, token, user: publicUser(user) });
}
async function session(request, env) { const auth = await requireAuth(request, env); return auth.response || json({ ok: true, user: publicUser(auth.user) }); }
async function logout(request, env) { const token = bearerToken(request); if (token) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run(); return json({ ok: true }); }

async function adminUsers(request, env) { const auth = await requireAdmin(request, env); if (auth.response) return auth.response; const result = await env.DB.prepare("SELECT id,username,name,phone,role,region,scheduled_start_time,is_active,created_at,last_login FROM users ORDER BY CASE role WHEN 'BOSS/지사장' THEN 0 ELSE 1 END, is_active ASC, created_at DESC").all(); return json({ ok: true, users: result.results ?? [] }); }
async function updateUser(request, env, id) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;

  const target = await env.DB.prepare(
    "SELECT role FROM users WHERE id = ?",
  ).bind(id).first();

  if (!target) return json({ message: "계정을 찾을 수 없습니다." }, 404);
  if (target.role === "BOSS/지사장") {
    return json({ message: "BOSS 계정은 변경할 수 없습니다." }, 403);
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const phone = normalizePhone(body.phone);
  const role = String(body.role ?? "");
  const region = String(body.region ?? "");
  const scheduledStartTime = String(body.scheduled_start_time ?? "10:00").trim();

  if (name.length < 2) {
    return json({ message: "이름을 확인해주세요." }, 400);
  }
  if (!/^01[016789]\d{7,8}$/.test(phone)) {
    return json({ message: "휴대전화 번호를 확인해주세요." }, 400);
  }
  if (!ALLOWED_ROLES.has(role) || !ALLOWED_REGIONS.has(region)) {
    return json({ message: "직책 또는 권역을 확인해주세요." }, 400);
  }
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(scheduledStartTime)) {
    return json({ message: "기준 출근시간을 HH:MM 형식으로 입력해주세요." }, 400);
  }

  await env.DB.prepare(`
    UPDATE users
    SET
      name = ?,
      phone = ?,
      role = ?,
      region = ?,
      scheduled_start_time = ?,
      is_active = CASE WHEN is_active = 0 THEN 1 ELSE is_active END
    WHERE id = ?
  `).bind(
    name,
    phone,
    role,
    region,
    scheduledStartTime,
    id,
  ).run();

  return json({ ok: true });
}


function operationalSettingsFromRows(rows = []) {
  const map = Object.fromEntries(rows.map((row) => [row.key, Number(row.value)]));
  return {
    setCount: {
      "강남중앙1": map.set_count_gangnam_central_1 ?? 6,
      "강남중앙2": map.set_count_gangnam_central_2 ?? 6,
      "강남서초중앙": map.set_count_gangnam_seocho_central ?? 8,
      "강남남중앙": map.set_count_gangnam_nam_central ?? 6,
    },
    readerInterval: map.reader_interval_seconds ?? 30,
    missionKeepMinutes: map.mission_keep_minutes ?? 60,
  };
}

async function getOperationalSettings(request, env) {
  const auth = await requireBoss(request, env);
  if (auth.response) return auth.response;
  const result = await env.DB.prepare("SELECT key, value, updated_at FROM operational_settings ORDER BY key").all();
  return json({ ok: true, settings: operationalSettingsFromRows(result.results ?? []) });
}

async function updateOperationalSettings(request, env) {
  const auth = await requireBoss(request, env);
  if (auth.response) return auth.response;
  const body = await request.json();
  const setCount = body?.setCount ?? {};
  const values = {
    set_count_gangnam_central_1: Number(setCount["강남중앙1"]),
    set_count_gangnam_central_2: Number(setCount["강남중앙2"]),
    set_count_gangnam_seocho_central: Number(setCount["강남서초중앙"]),
    set_count_gangnam_nam_central: Number(setCount["강남남중앙"]),
    reader_interval_seconds: Number(body.readerInterval),
    mission_keep_minutes: Number(body.missionKeepMinutes),
  };
  for (const key of [
    "set_count_gangnam_central_1",
    "set_count_gangnam_central_2",
    "set_count_gangnam_seocho_central",
    "set_count_gangnam_nam_central",
  ]) {
    if (!Number.isInteger(values[key]) || values[key] < 1 || values[key] > 20) {
      return json({ message: "SET 수는 1~20 사이의 정수로 입력해주세요." }, 400);
    }
  }
  if (!Number.isInteger(values.reader_interval_seconds) || values.reader_interval_seconds < 10 || values.reader_interval_seconds > 300) {
    return json({ message: "Reader 수집 주기는 10~300초로 입력해주세요." }, 400);
  }
  if (!Number.isInteger(values.mission_keep_minutes) || values.mission_keep_minutes < 0 || values.mission_keep_minutes > 180) {
    return json({ message: "팀미션 유지시간은 0~180분으로 입력해주세요." }, 400);
  }
  const statements = Object.entries(values).map(([key, value]) => env.DB.prepare(`
    INSERT INTO operational_settings (key, value, updated_at, updated_by)
    VALUES (?, ?, CURRENT_TIMESTAMP, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by
  `).bind(key, String(value), auth.user.id));
  await env.DB.batch(statements);
  const result = await env.DB.prepare("SELECT key, value FROM operational_settings ORDER BY key").all();
  return json({ ok: true, settings: operationalSettingsFromRows(result.results ?? []) });
}

async function updateLiveLocation(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.response) return auth.response;

  const body = await request.json();
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);
  const accuracy = body.accuracy == null ? null : Number(body.accuracy);
  const heading = body.heading == null ? null : Number(body.heading);
  const speed = body.speed == null ? null : Number(body.speed);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return json({ message: "위도 값이 올바르지 않습니다." }, 400);
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return json({ message: "경도 값이 올바르지 않습니다." }, 400);
  }

  await env.DB.prepare(`
    INSERT INTO live_locations (
      user_id, latitude, longitude, accuracy, heading, speed, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      accuracy = excluded.accuracy,
      heading = excluded.heading,
      speed = excluded.speed,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    auth.user.id,
    latitude,
    longitude,
    Number.isFinite(accuracy) ? accuracy : null,
    Number.isFinite(heading) ? heading : null,
    Number.isFinite(speed) ? speed : null,
  ).run();

  return json({ ok: true });
}

async function listLiveLocations(request, env) {
  const auth = await requireBoss(request, env);
  if (auth.response) return auth.response;

  const workDate = attendanceWorkDate();
  const result = await env.DB.prepare(`
    SELECT
      u.id AS user_id,
      u.name,
      u.username,
      u.role,
      u.region,
      l.latitude,
      l.longitude,
      l.accuracy,
      l.heading,
      l.speed,
      l.updated_at,
      COALESCE(a.status, '미출근') AS attendance_status,
      COALESCE(a.orders, 0) AS orders
    FROM users u
    LEFT JOIN live_locations l ON l.user_id = u.id
    LEFT JOIN attendance a
      ON a.user_id = u.id
      AND a.work_date = ?
    WHERE u.is_active = 1
    ORDER BY CASE u.role WHEN 'BOSS/지사장' THEN 0 ELSE 1 END, u.name
  `).bind(workDate).all();

  return json({ ok: true, locations: result.results || [] });
}

async function changeOwnPassword(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.response) return auth.response;

  const body = await request.json();
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");

  if (newPassword.length < 8) {
    return json({ message: "새 비밀번호를 8자 이상 입력해주세요." }, 400);
  }

  const user = await env.DB.prepare(
    "SELECT password_hash FROM users WHERE id = ? LIMIT 1",
  ).bind(auth.user.id).first();

  if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
    return json({ message: "현재 비밀번호가 올바르지 않습니다." }, 401);
  }

  if (await verifyPassword(newPassword, user.password_hash)) {
    return json({ message: "현재 비밀번호와 다른 비밀번호를 입력해주세요." }, 400);
  }

  await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .bind(await hashPassword(newPassword), auth.user.id).run();

  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND token != ?")
    .bind(auth.user.id, bearerToken(request)).run();

  return json({ ok: true, message: "비밀번호를 변경했습니다." });
}


function seoulParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function attendanceWorkDate() {
  const now = new Date();
  const parts = seoulParts(now);
  let date = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00+09:00`);
  if (Number(parts.hour) < 6) date = new Date(date.getTime() - 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function currentSeoulMinutes() {
  const parts = seoulParts();
  return Number(parts.hour) * 60 + Number(parts.minute);
}

function scheduledMinutes(value) {
  const match = String(value || "10:00").match(/^(\d{2}):(\d{2})$/);
  if (!match) return 600;
  return Number(match[1]) * 60 + Number(match[2]);
}

function calculateLateMinutes(scheduledStartTime) {
  return Math.max(0, currentSeoulMinutes() - scheduledMinutes(scheduledStartTime));
}

const ATTENDANCE_STATUS = new Set(["근무 중", "식사중", "휴식", "배정대기중", "퇴근", "휴무", "미출근"]);

async function attendanceToday(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.response) return auth.response;

  const workDate = attendanceWorkDate();

  const result = await env.DB.prepare(`
    SELECT
      u.id AS user_id,
      u.username,
      u.name,
      u.role,
      u.region,
      CASE
        WHEN u.role = 'BOSS/지사장' THEN NULL
        ELSE COALESCE(u.scheduled_start_time, '10:00')
      END AS scheduled_start_time,
      CASE
        WHEN a.status IS NOT NULL THEN a.status
        WHEN l.id IS NOT NULL AND l.status IN ('자동 승인', '승인 완료') THEN '휴무'
        ELSE '미출근'
      END AS status,
      a.check_in,
      a.check_out,
      a.orders,
      CASE
        WHEN u.role = 'BOSS/지사장' THEN 0
        ELSE COALESCE(a.late, 0)
      END AS late,
      CASE
        WHEN u.role = 'BOSS/지사장' THEN 0
        ELSE COALESCE(a.late_minutes, 0)
      END AS late_minutes,
      COALESCE(a.absent, 0) AS absent,
      COALESCE(a.approved_checkin, 0) AS approved_checkin,
      COALESCE(a.reason, l.memo) AS reason,
      l.status AS leave_status
    FROM users u
    LEFT JOIN attendance a
      ON a.user_id = u.id
      AND a.work_date = ?
    LEFT JOIN leave_requests l
      ON l.user_id = u.id
      AND l.leave_date = ?
      AND l.status IN ('자동 승인', '승인 완료')
    WHERE u.is_active = 1
    ORDER BY
      CASE u.role
        WHEN 'BOSS/지사장' THEN 0
        WHEN '총괄본부장' THEN 1
        WHEN '운영실장' THEN 2
        WHEN '운영팀장' THEN 3
        ELSE 4
      END,
      u.name
  `).bind(workDate, workDate).all();

  const leaves = await env.DB.prepare(`
    SELECT
      l.id,
      l.leave_date AS date,
      l.reason,
      l.memo,
      l.status,
      u.name,
      u.role,
      u.region
    FROM leave_requests l
    JOIN users u ON u.id = l.user_id
    WHERE u.is_active = 1
      AND l.leave_date BETWEEN date(?, '-45 day') AND date(?, '+90 day')
    ORDER BY l.leave_date, u.name
  `).bind(workDate, workDate).all();

  const managers = result.results || [];
  const current =
    managers.find((row) => Number(row.user_id) === Number(auth.user.id)) || null;

  return json({
    ok: true,
    workDate,
    current,
    managers,
    leaves: leaves.results || [],
  });
}

async function attendanceAction(request, env) {
  const auth = await requireAuth(request, env); if (auth.response) return auth.response;
  const body = await request.json();
  const action = String(body.action || "");
  const workDate = attendanceWorkDate();
  const existing = await env.DB.prepare("SELECT * FROM attendance WHERE user_id = ? AND work_date = ?").bind(auth.user.id, workDate).first();
  const now = new Date().toISOString();

  if (action === "checkin" || action === "approved_checkin") {
    const approved = action === "approved_checkin" ? 1 : 0;
    const userSchedule = await env.DB.prepare(`
      SELECT role, COALESCE(scheduled_start_time, '10:00') AS scheduled_start_time
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(auth.user.id).first();

    const lateMinutes =
      userSchedule?.role === "BOSS/지사장" || approved
        ? 0
        : calculateLateMinutes(userSchedule?.scheduled_start_time || "10:00");
    const late = lateMinutes > 0 ? 1 : 0;
    const reason = String(body.reason || "").trim() || null;

    await env.DB.prepare(`
      INSERT INTO attendance (
        user_id,
        work_date,
        status,
        check_in,
        late,
        late_minutes,
        absent,
        approved_checkin,
        approved_by,
        reason,
        updated_at
      )
      VALUES (?, ?, '근무 중', ?, ?, ?, 0, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, work_date) DO UPDATE SET
        status = '근무 중',
        check_in = COALESCE(attendance.check_in, excluded.check_in),
        check_out = NULL,
        late = excluded.late,
        late_minutes = excluded.late_minutes,
        absent = 0,
        approved_checkin = excluded.approved_checkin,
        approved_by = excluded.approved_by,
        reason = excluded.reason,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      auth.user.id,
      workDate,
      now,
      late,
      lateMinutes,
      approved,
      approved ? auth.user.id : null,
      reason,
    ).run();
  } else if (["meal", "break", "standby", "resume"].includes(action)) {
    if (!existing?.check_in) return json({ message: "먼저 출근 체크를 해주세요." }, 409);
    const statusMap = { meal: "식사중", break: "휴식", standby: "배정대기중", resume: "근무 중" };
    await env.DB.prepare("UPDATE attendance SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND work_date = ?").bind(statusMap[action], auth.user.id, workDate).run();
  } else if (action === "checkout") {
    if (!existing?.check_in) return json({ message: "먼저 출근 체크를 해주세요." }, 409);
    const orders = Number(body.orders);
    if (!Number.isInteger(orders) || orders < 0) return json({ message: "수행건수를 0 이상의 숫자로 입력해주세요." }, 400);
    await env.DB.prepare("UPDATE attendance SET status='퇴근', check_out=?, orders=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND work_date=?").bind(now, orders, auth.user.id, workDate).run();
  } else {
    return json({ message: "지원하지 않는 근태 동작입니다." }, 400);
  }
  return attendanceToday(request, env);
}

async function attendanceLeave(request, env) {
  const auth = await requireAuth(request, env); if (auth.response) return auth.response;
  const body = await request.json();
  const leaveDate = String(body.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(leaveDate)) return json({ message: "휴무 날짜를 확인해주세요." }, 400);
  const today = attendanceWorkDate();
  const dayDiff = Math.floor((Date.parse(`${leaveDate}T00:00:00+09:00`) - Date.parse(`${today}T00:00:00+09:00`)) / 86400000);
  if (dayDiff < 0) return json({ message: "지난 날짜에는 휴무를 등록할 수 없습니다." }, 400);
  const status = dayDiff >= 2 ? "자동 승인" : "승인 대기";
  const memo = String(body.memo || "").trim();
  try {
    await env.DB.prepare(`INSERT INTO leave_requests (user_id, leave_date, reason, memo, status) VALUES (?, ?, '일반 휴무', ?, ?)`)
      .bind(auth.user.id, leaveDate, memo || null, status).run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) return json({ message: "이미 해당 날짜에 휴무가 등록되어 있습니다." }, 409);
    throw error;
  }
  return json({ ok: true, status, message: status === "자동 승인" ? "휴무가 자동 승인되었습니다." : "긴급 휴무 승인 대기로 등록되었습니다." }, 201);
}

export default { async fetch(request, env) {
  try { await ensureTables(env.DB); const url = new URL(request.url); const p=url.pathname; const m=request.method;
    if (p==="/api/health" && m==="GET") return json({ok:true,database:true,message:"Worker와 D1 연결이 정상입니다."});
    if (p==="/api/bootstrap/status" && m==="GET") return bootstrapStatus(env); if (p==="/api/bootstrap/create" && m==="POST") return bootstrapCreate(request,env);
    if (p==="/api/signup" && m==="POST") return signup(request,env); if (p==="/api/login" && m==="POST") return login(request,env); if (p==="/api/session" && m==="GET") return session(request,env); if (p==="/api/logout" && m==="POST") return logout(request,env);
    const locationExempt = new Set(["/api/location/update"]);
    if (p.startsWith("/api/") && !locationExempt.has(p) && !p.startsWith("/api/reader/")) {
      const locationAuth = await requireFreshLocation(request, env);
      if (locationAuth.response) return locationAuth.response;
    }
    if (p==="/api/settings/profile" && m==="PATCH") return updateOwnProfile(request,env);
    if (p==="/api/settings/password" && m==="POST") return changeOwnPassword(request,env);
    if (p==="/api/settings/operations" && m==="GET") return getOperationalSettings(request,env);
    if (p==="/api/settings/operations" && m==="PATCH") return updateOperationalSettings(request,env);
    if (p==="/api/reader/riders" && m==="POST") return ingestReaderRiders(request,env);
    if (p==="/api/riders" && m==="GET") return listRiders(request,env);
    if (p==="/api/location/update" && m==="POST") return updateLiveLocation(request,env);
    if (p==="/api/live-map/locations" && m==="GET") return listLiveLocations(request,env);
    if (p==="/api/attendance/today" && m==="GET") return attendanceToday(request,env); if (p==="/api/attendance/action" && m==="POST") return attendanceAction(request,env); if (p==="/api/attendance/leave" && m==="POST") return attendanceLeave(request,env);
    if (p==="/api/admin/users" && m==="GET") return adminUsers(request,env);
    let match=p.match(/^\/api\/admin\/users\/(\d+)$/); if (match && m==="PATCH") return updateUser(request,env,Number(match[1])); if (match && m==="DELETE") return deletePending(request,env,Number(match[1]));
    match=p.match(/^\/api\/admin\/users\/(\d+)\/suspend$/); if(match&&m==="PATCH") return changeStatus(request,env,Number(match[1]),2); match=p.match(/^\/api\/admin\/users\/(\d+)\/reactivate$/); if(match&&m==="PATCH") return changeStatus(request,env,Number(match[1]),1); match=p.match(/^\/api\/admin\/users\/(\d+)\/reset-password$/); if(match&&m==="POST") return resetPassword(request,env,Number(match[1]));
    if (p.startsWith("/api/live-map/")) { const auth=await requireBoss(request,env); return auth.response || json({ok:true}); }
    if (p.startsWith("/api/")) return json({message:"API를 찾을 수 없습니다."},404); return env.ASSETS.fetch(request);
  } catch(error) { console.error("worker error",error); return json({message:"서버 처리 중 오류가 발생했습니다."},500); }
}};
