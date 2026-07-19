var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var json = /* @__PURE__ */ __name((data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
}), "json");
var normalizeUsername = /* @__PURE__ */ __name((value) => String(value ?? "").trim().toLowerCase(), "normalizeUsername");
var normalizePhone = /* @__PURE__ */ __name((value) => String(value ?? "").replace(/\D/g, ""), "normalizePhone");
var ADMIN_ROLES = /* @__PURE__ */ new Set(["BOSS/\uC9C0\uC0AC\uC7A5", "\uCD1D\uAD04\uBCF8\uBD80\uC7A5", "\uC6B4\uC601\uC2E4\uC7A5", "\uC6B4\uC601\uD300\uC7A5"]);
var ALLOWED_ROLES = /* @__PURE__ */ new Set(["\uCD1D\uAD04\uBCF8\uBD80\uC7A5", "\uC6B4\uC601\uC2E4\uC7A5", "\uC6B4\uC601\uD300\uC7A5", "\uAC15\uB0A8\uCD1D\uAD04\uD300\uC7A5", "\uAC15\uB0A8\uC911\uC5591 \uD300\uC7A5", "\uAC15\uB0A8\uC911\uC5592 \uD300\uC7A5", "\uAC15\uB0A8\uC11C\uCD08\uC911\uC559 \uD300\uC7A5", "\uAC15\uB0A8\uB0A8\uC911\uC559 \uD300\uC7A5", "\uAC15\uB0A8\uC11C\uBD80 \uD300\uC7A5", "\uD300\uC7A5"]);
var ALLOWED_REGIONS = /* @__PURE__ */ new Set(["\uC804\uAD8C\uC5ED \uC6B4\uC601", "\uAC15\uB0A8\uC911\uC5591", "\uAC15\uB0A8\uC911\uC5592", "\uAC15\uB0A8\uC11C\uCD08\uC911\uC559", "\uAC15\uB0A8\uB0A8\uC911\uC559", "\uAC15\uB0A8\uC11C\uBD80", "\uAD8C\uC5ED\uC5C6\uC74C(\uD604\uC7A5\uD300\uC7A5)"]);
function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
__name(bytesToBase64, "bytesToBase64");
function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}
__name(base64ToBytes, "base64ToBytes");
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
__name(randomToken, "randomToken");
async function derivePassword(password, salt, iterations) {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, keyMaterial, 256);
  return new Uint8Array(bits);
}
__name(derivePassword, "derivePassword");
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 1e5;
  const hash = await derivePassword(password, salt, iterations);
  return `pbkdf2_sha256$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, storedHash) {
  try {
    const [algorithm, iterationValue, saltValue, expectedValue] = String(storedHash).split("$");
    if (algorithm !== "pbkdf2_sha256") return false;
    const actual = await derivePassword(password, base64ToBytes(saltValue), Number(iterationValue));
    const expected = base64ToBytes(expectedValue);
    if (actual.length !== expected.length) return false;
    let difference = 0;
    for (let i = 0; i < actual.length; i += 1) difference |= actual[i] ^ expected[i];
    return difference === 0;
  } catch {
    return false;
  }
}
__name(verifyPassword, "verifyPassword");
async function ensureTables(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT '\uD300\uC7A5', region TEXT DEFAULT '\uBBF8\uBC30\uC815', is_active INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_login DATETIME, phone TEXT)`).run();
  const info = await db.prepare("PRAGMA table_info(users)").all();
  const names = new Set((info.results ?? []).map((column) => column.name));
  if (!names.has("phone")) await db.prepare("ALTER TABLE users ADD COLUMN phone TEXT").run();
  if (!names.has("scheduled_start_time")) {
    await db.prepare("ALTER TABLE users ADD COLUMN scheduled_start_time TEXT DEFAULT '10:00'").run();
  }
  await db.prepare(`
    UPDATE users
    SET role = 'BOSS/\uC9C0\uC0AC\uC7A5',
        region = '\uC804\uAD8C\uC5ED \uC6B4\uC601',
        is_active = 1
    WHERE lower(trim(username)) = 'boss'
  `).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`).run();
  await db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(Math.floor(Date.now() / 1e3)).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    work_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '\uBBF8\uCD9C\uADFC',
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
    reason TEXT NOT NULL DEFAULT '\uC77C\uBC18 \uD734\uBB34',
    memo TEXT,
    status TEXT NOT NULL DEFAULT '\uC2B9\uC778 \uB300\uAE30',
    approved_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, leave_date),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS riders_live (
    region TEXT NOT NULL,
    rider_key TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT '\uC624\uD504\uB77C\uC778',
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
__name(ensureTables, "ensureTables");
function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    phone: user.phone,
    role: user.role,
    region: user.region,
    scheduled_start_time: user.role === "BOSS/\uC9C0\uC0AC\uC7A5" ? null : user.scheduled_start_time || "10:00"
  };
}
__name(publicUser, "publicUser");
async function createSession(db, userId, remember = true) {
  const token = randomToken();
  const ttl = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12;
  const expiresAt = Math.floor(Date.now() / 1e3) + ttl;
  await db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").bind(token, userId, expiresAt).run();
  return token;
}
__name(createSession, "createSession");
function bearerToken(request) {
  const auth = request.headers.get("Authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}
__name(bearerToken, "bearerToken");
async function authenticate(request, env) {
  const token = bearerToken(request);
  if (!token) return null;
  const row = await env.DB.prepare(`SELECT u.id, u.username, u.name, u.phone, u.role, u.region, u.scheduled_start_time, u.is_active, s.token FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ? LIMIT 1`).bind(token, Math.floor(Date.now() / 1e3)).first();
  if (!row || Number(row.is_active) !== 1) return null;
  return row;
}
__name(authenticate, "authenticate");
async function requireAuth(request, env) {
  const user = await authenticate(request, env);
  return user ? { user } : { response: json({ message: "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." }, 401) };
}
__name(requireAuth, "requireAuth");
async function requireAdmin(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.response) return auth;
  if (!ADMIN_ROLES.has(auth.user.role)) return { response: json({ message: "\uAD00\uB9AC\uC790 \uAD00\uB9AC \uAD8C\uD55C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." }, 403) };
  return auth;
}
__name(requireAdmin, "requireAdmin");
async function requireBoss(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.response) return auth;
  if (auth.user.role !== "BOSS/\uC9C0\uC0AC\uC7A5") return { response: json({ message: "BOSS \uC804\uC6A9 \uAD8C\uD55C\uC785\uB2C8\uB2E4." }, 403) };
  return auth;
}
__name(requireBoss, "requireBoss");
function normalizeRiderRegion(value) {
  const raw = String(value ?? "").trim().replace(/\s+/g, "");
  if (raw === "\uB0A8\uC911\uC559" || raw === "\uAC15\uB0A8\uB0A8\uC911\uC559") return "\uAC15\uB0A8\uB0A8\uC911\uC559";
  if (raw === "\uAC15\uB0A8\uC11C\uCD08\uC911\uC559" || raw === "\uC11C\uCD08\uC911\uC559") return "\uAC15\uB0A8\uC11C\uCD08\uC911\uC559";
  if (raw === "\uAC15\uB0A8\uC911\uC5591" || raw === "\uC911\uC5591") return "\uAC15\uB0A8\uC911\uC5591";
  if (raw === "\uAC15\uB0A8\uC911\uC5592" || raw === "\uC911\uC5592") return "\uAC15\uB0A8\uC911\uC5592";
  return String(value ?? "").trim();
}
__name(normalizeRiderRegion, "normalizeRiderRegion");
function riderNumber(value) {
  const number = Number(String(value ?? 0).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}
__name(riderNumber, "riderNumber");
function normalizeRiderStatus(value, online) {
  const text = String(value ?? "").trim();
  if (!online && !/배달|운행|온라인|대기/.test(text)) return "\uC624\uD504\uB77C\uC778";
  if (/배달|운행/.test(text)) return "\uBC30\uB2EC\uC911";
  if (/대기|온라인/.test(text) || online) return "\uB300\uAE30\uC911";
  return "\uC624\uD504\uB77C\uC778";
}
__name(normalizeRiderStatus, "normalizeRiderStatus");
async function ingestReaderRiders(request, env) {
  const configuredKey = String(env.NTC_INGEST_KEY ?? "").trim();
  const suppliedKey = String(request.headers.get("X-NTC-Ingest-Key") ?? "").trim();
  if (!configuredKey || suppliedKey !== configuredKey) return json({ message: "\uC218\uC9D1 \uC778\uC99D\uD0A4\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ message: "JSON \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, 400);
  }
  const region = normalizeRiderRegion(body.region);
  const allowed = /* @__PURE__ */ new Set(["\uAC15\uB0A8\uC911\uC5591", "\uAC15\uB0A8\uC911\uC5592", "\uAC15\uB0A8\uC11C\uCD08\uC911\uC559", "\uAC15\uB0A8\uB0A8\uC911\uC559"]);
  if (!allowed.has(region)) return json({ message: "\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uAD8C\uC5ED\uC785\uB2C8\uB2E4." }, 400);
  const riders = Array.isArray(body.riders) ? body.riders : [];
  const receivedAt = (/* @__PURE__ */ new Date()).toISOString();
  const statements = [env.DB.prepare("DELETE FROM riders_live WHERE region = ?").bind(region)];
  riders.forEach((item, index) => {
    const name = String(item?.name ?? item?.\uAE30\uC0AC\uBA85 ?? "").trim();
    if (!name) return;
    const riderKey = String(item?.id ?? item?.rider_id ?? item?.key ?? `${name}-${index}`).trim();
    const online = Boolean(item?.online) || /배달|운행|온라인|대기/.test(String(item?.status ?? item?.\uC0C1\uD0DC ?? ""));
    const status = normalizeRiderStatus(item?.status ?? item?.\uC0C1\uD0DC, online);
    statements.push(env.DB.prepare(`INSERT INTO riders_live (region,rider_key,name,status,online,rejected,canceled,completed,lunch,dinner,non_peak,source_updated_at,received_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(region, riderKey, name, status, online ? 1 : 0, riderNumber(item?.rejected ?? item?.reject ?? item?.\uAC70\uC808), riderNumber(item?.canceled ?? item?.cancel ?? item?.\uCDE8\uC18C), riderNumber(item?.completed ?? item?.done ?? item?.\uC644\uB8CC), riderNumber(item?.lunch ?? item?.\uC810\uC2EC\uD53C\uD06C ?? item?.\uC810\uC2EC), riderNumber(item?.dinner ?? item?.\uC800\uB141\uD53C\uD06C ?? item?.\uC800\uB141), riderNumber(item?.nonPeak ?? item?.non_peak ?? item?.\uB17C\uD53C\uD06C), String(item?.updated_at ?? body.updated_at ?? receivedAt), receivedAt));
  });
  statements.push(env.DB.prepare(`INSERT INTO rider_sync_state (region,rider_count,received_at) VALUES (?,?,?) ON CONFLICT(region) DO UPDATE SET rider_count=excluded.rider_count, received_at=excluded.received_at`).bind(region, riders.length, receivedAt));
  await env.DB.batch(statements);
  return json({ ok: true, region, received: riders.length, receivedAt });
}
__name(ingestReaderRiders, "ingestReaderRiders");
async function listRiders(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const region = normalizeRiderRegion(url.searchParams.get("region") || "");
  const where = region ? "WHERE region = ?" : "";
  const query = `SELECT region,rider_key AS id,name,status,online,rejected,canceled,completed,lunch,dinner,non_peak AS nonPeak,source_updated_at,received_at FROM riders_live ${where} ORDER BY CASE status WHEN '\uBC30\uB2EC\uC911' THEN 0 WHEN '\uB300\uAE30\uC911' THEN 1 ELSE 2 END, completed DESC, name ASC`;
  const result = region ? await env.DB.prepare(query).bind(region).all() : await env.DB.prepare(query).all();
  const sync = await env.DB.prepare("SELECT region,rider_count,received_at FROM rider_sync_state ORDER BY region").all();
  return json({ ok: true, riders: result.results ?? [], sync: sync.results ?? [] });
}
__name(listRiders, "listRiders");
async function bootstrapStatus(env) {
  await ensureTables(env.DB);
  const boss = await env.DB.prepare("SELECT id FROM users WHERE role = 'BOSS/\uC9C0\uC0AC\uC7A5' LIMIT 1").first();
  return json({ ok: true, needsBootstrap: !boss });
}
__name(bootstrapStatus, "bootstrapStatus");
async function bootstrapCreate(request, env) {
  await ensureTables(env.DB);
  const existingBoss = await env.DB.prepare("SELECT id FROM users WHERE role = 'BOSS/\uC9C0\uC0AC\uC7A5' LIMIT 1").first();
  if (existingBoss) return json({ message: "BOSS \uACC4\uC815\uC774 \uC774\uBBF8 \uC874\uC7AC\uD569\uB2C8\uB2E4." }, 409);
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const phone = normalizePhone(body.phone);
  const username = normalizeUsername(body.username);
  const password = String(body.password ?? "");
  if (name.length < 2) return json({ field: "name", message: "\uC774\uB984\uC744 2\uC790 \uC774\uC0C1 \uC785\uB825\uD574\uC8FC\uC138\uC694." }, 400);
  if (!/^01[016789]\d{7,8}$/.test(phone)) return json({ field: "phone", message: "\uD734\uB300\uC804\uD654 \uBC88\uD638\uB97C \uD655\uC778\uD574\uC8FC\uC138\uC694." }, 400);
  if (!/^[a-z0-9_-]{4,20}$/.test(username)) return json({ field: "username", message: "\uC544\uC774\uB514 \uD615\uC2DD\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694." }, 400);
  if (password.length < 8) return json({ field: "password", message: "\uBE44\uBC00\uBC88\uD638\uB97C 8\uC790 \uC774\uC0C1 \uC785\uB825\uD574\uC8FC\uC138\uC694." }, 400);
  const duplicate = await env.DB.prepare("SELECT id FROM users WHERE username = ? OR phone = ? LIMIT 1").bind(username, phone).first();
  if (duplicate) return json({ message: "\uC774\uBBF8 \uC0AC\uC6A9 \uC911\uC778 \uC544\uC774\uB514 \uB610\uB294 \uD734\uB300\uC804\uD654 \uBC88\uD638\uC785\uB2C8\uB2E4." }, 409);
  const result = await env.DB.prepare(`INSERT INTO users (username,password_hash,name,role,region,is_active,created_at,phone) VALUES (?, ?, ?, 'BOSS/\uC9C0\uC0AC\uC7A5', '\uC804\uAD8C\uC5ED \uC6B4\uC601', 1, CURRENT_TIMESTAMP, ?)`).bind(username, await hashPassword(password), name, phone).run();
  const user = await env.DB.prepare("SELECT id, username, name, phone, role, region, scheduled_start_time FROM users WHERE id = ?").bind(result.meta.last_row_id).first();
  const token = await createSession(env.DB, user.id, true);
  return json({ ok: true, token, user: publicUser(user) }, 201);
}
__name(bootstrapCreate, "bootstrapCreate");
async function signup(request, env) {
  await ensureTables(env.DB);
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const phone = normalizePhone(body.phone);
  const username = normalizeUsername(body.username);
  const password = String(body.password ?? "");
  if (name.length < 2) return json({ field: "name", message: "\uC774\uB984\uC744 2\uC790 \uC774\uC0C1 \uC785\uB825\uD574\uC8FC\uC138\uC694." }, 400);
  if (!/^01[016789]\d{7,8}$/.test(phone)) return json({ field: "phone", message: "\uD734\uB300\uC804\uD654 \uBC88\uD638\uB97C \uD655\uC778\uD574\uC8FC\uC138\uC694." }, 400);
  if (!/^[a-z0-9_-]{4,20}$/.test(username)) return json({ field: "username", message: "\uC544\uC774\uB514 \uD615\uC2DD\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694." }, 400);
  if (password.length < 8) return json({ field: "password", message: "\uBE44\uBC00\uBC88\uD638\uB97C 8\uC790 \uC774\uC0C1 \uC785\uB825\uD574\uC8FC\uC138\uC694." }, 400);
  const existing = await env.DB.prepare("SELECT username, phone FROM users WHERE username = ? OR phone = ? LIMIT 1").bind(username, phone).first();
  if (existing?.username === username) return json({ field: "username", message: "\uC774\uBBF8 \uC0AC\uC6A9 \uC911\uC778 \uC544\uC774\uB514\uC785\uB2C8\uB2E4." }, 409);
  if (existing?.phone === phone) return json({ field: "phone", message: "\uC774\uBBF8 \uAC00\uC785 \uC2E0\uCCAD\uB41C \uD734\uB300\uC804\uD654 \uBC88\uD638\uC785\uB2C8\uB2E4." }, 409);
  const result = await env.DB.prepare(`INSERT INTO users (username,password_hash,name,role,region,is_active,created_at,phone) VALUES (?, ?, ?, '\uD300\uC7A5', '\uBBF8\uBC30\uC815', 0, CURRENT_TIMESTAMP, ?)`).bind(username, await hashPassword(password), name, phone).run();
  return json({ ok: true, status: "pending", userId: result.meta?.last_row_id ?? null, message: "\uAC00\uC785 \uC2E0\uCCAD\uC774 \uC811\uC218\uB418\uC5C8\uC2B5\uB2C8\uB2E4." }, 201);
}
__name(signup, "signup");
async function login(request, env) {
  await ensureTables(env.DB);
  const body = await request.json();
  const username = normalizeUsername(body.username);
  const password = String(body.password ?? "");
  const remember = Boolean(body.remember);
  const user = await env.DB.prepare("SELECT id,username,password_hash,name,phone,role,region,scheduled_start_time,is_active FROM users WHERE username = ? LIMIT 1").bind(username).first();
  if (!user || !await verifyPassword(password, user.password_hash)) return json({ field: "loginPassword", message: "\uC544\uC774\uB514 \uB610\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, 401);
  if (Number(user.is_active) === 0) return json({ field: "loginPassword", message: "\uC544\uC9C1 \uCD5C\uACE0\uAD00\uB9AC\uC790\uC758 \uC2B9\uC778 \uB300\uAE30 \uC911\uC785\uB2C8\uB2E4." }, 403);
  if (Number(user.is_active) === 2) return json({ field: "loginPassword", message: "\uC0AC\uC6A9\uC774 \uC815\uC9C0\uB41C \uACC4\uC815\uC785\uB2C8\uB2E4." }, 403);
  await env.DB.prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?").bind(user.id).run();
  const token = await createSession(env.DB, user.id, remember);
  return json({ ok: true, token, user: publicUser(user) });
}
__name(login, "login");
async function session(request, env) {
  const auth = await requireAuth(request, env);
  return auth.response || json({ ok: true, user: publicUser(auth.user) });
}
__name(session, "session");
async function logout(request, env) {
  const token = bearerToken(request);
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  return json({ ok: true });
}
__name(logout, "logout");
async function adminUsers(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  const result = await env.DB.prepare("SELECT id,username,name,phone,role,region,scheduled_start_time,is_active,created_at,last_login FROM users ORDER BY CASE role WHEN 'BOSS/\uC9C0\uC0AC\uC7A5' THEN 0 ELSE 1 END, is_active ASC, created_at DESC").all();
  return json({ ok: true, users: result.results ?? [] });
}
__name(adminUsers, "adminUsers");
async function updateUser(request, env, id) {
  const auth = await requireAdmin(request, env);
  if (auth.response) return auth.response;
  const target = await env.DB.prepare(
    "SELECT role FROM users WHERE id = ?"
  ).bind(id).first();
  if (!target) return json({ message: "\uACC4\uC815\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
  if (target.role === "BOSS/\uC9C0\uC0AC\uC7A5") {
    return json({ message: "BOSS \uACC4\uC815\uC740 \uBCC0\uACBD\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 403);
  }
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const phone = normalizePhone(body.phone);
  const role = String(body.role ?? "");
  const region = String(body.region ?? "");
  const scheduledStartTime = String(body.scheduled_start_time ?? "10:00").trim();
  if (name.length < 2) {
    return json({ message: "\uC774\uB984\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694." }, 400);
  }
  if (!/^01[016789]\d{7,8}$/.test(phone)) {
    return json({ message: "\uD734\uB300\uC804\uD654 \uBC88\uD638\uB97C \uD655\uC778\uD574\uC8FC\uC138\uC694." }, 400);
  }
  if (!ALLOWED_ROLES.has(role) || !ALLOWED_REGIONS.has(region)) {
    return json({ message: "\uC9C1\uCC45 \uB610\uB294 \uAD8C\uC5ED\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694." }, 400);
  }
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(scheduledStartTime)) {
    return json({ message: "\uAE30\uC900 \uCD9C\uADFC\uC2DC\uAC04\uC744 HH:MM \uD615\uC2DD\uC73C\uB85C \uC785\uB825\uD574\uC8FC\uC138\uC694." }, 400);
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
    id
  ).run();
  return json({ ok: true });
}
__name(updateUser, "updateUser");
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
    return json({ message: "\uC704\uB3C4 \uAC12\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, 400);
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return json({ message: "\uACBD\uB3C4 \uAC12\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, 400);
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
    Number.isFinite(speed) ? speed : null
  ).run();
  return json({ ok: true });
}
__name(updateLiveLocation, "updateLiveLocation");
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
      COALESCE(a.status, '\uBBF8\uCD9C\uADFC') AS attendance_status,
      COALESCE(a.orders, 0) AS orders
    FROM users u
    LEFT JOIN live_locations l ON l.user_id = u.id
    LEFT JOIN attendance a
      ON a.user_id = u.id
      AND a.work_date = ?
    WHERE u.is_active = 1
    ORDER BY CASE u.role WHEN 'BOSS/\uC9C0\uC0AC\uC7A5' THEN 0 ELSE 1 END, u.name
  `).bind(workDate).all();
  return json({ ok: true, locations: result.results || [] });
}
__name(listLiveLocations, "listLiveLocations");
async function changeOwnPassword(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.response) return auth.response;
  const body = await request.json();
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  if (newPassword.length < 8) {
    return json({ message: "\uC0C8 \uBE44\uBC00\uBC88\uD638\uB97C 8\uC790 \uC774\uC0C1 \uC785\uB825\uD574\uC8FC\uC138\uC694." }, 400);
  }
  const user = await env.DB.prepare(
    "SELECT password_hash FROM users WHERE id = ? LIMIT 1"
  ).bind(auth.user.id).first();
  if (!user || !await verifyPassword(currentPassword, user.password_hash)) {
    return json({ message: "\uD604\uC7AC \uBE44\uBC00\uBC88\uD638\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." }, 401);
  }
  if (await verifyPassword(newPassword, user.password_hash)) {
    return json({ message: "\uD604\uC7AC \uBE44\uBC00\uBC88\uD638\uC640 \uB2E4\uB978 \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694." }, 400);
  }
  await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(await hashPassword(newPassword), auth.user.id).run();
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND token != ?").bind(auth.user.id, bearerToken(request)).run();
  return json({ ok: true, message: "\uBE44\uBC00\uBC88\uD638\uB97C \uBCC0\uACBD\uD588\uC2B5\uB2C8\uB2E4." });
}
__name(changeOwnPassword, "changeOwnPassword");
function seoulParts(date = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}
__name(seoulParts, "seoulParts");
function attendanceWorkDate() {
  const now = /* @__PURE__ */ new Date();
  const parts = seoulParts(now);
  let date = /* @__PURE__ */ new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00+09:00`);
  if (Number(parts.hour) < 6) date = new Date(date.getTime() - 864e5);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
__name(attendanceWorkDate, "attendanceWorkDate");
function currentSeoulMinutes() {
  const parts = seoulParts();
  return Number(parts.hour) * 60 + Number(parts.minute);
}
__name(currentSeoulMinutes, "currentSeoulMinutes");
function scheduledMinutes(value) {
  const match = String(value || "10:00").match(/^(\d{2}):(\d{2})$/);
  if (!match) return 600;
  return Number(match[1]) * 60 + Number(match[2]);
}
__name(scheduledMinutes, "scheduledMinutes");
function calculateLateMinutes(scheduledStartTime) {
  return Math.max(0, currentSeoulMinutes() - scheduledMinutes(scheduledStartTime));
}
__name(calculateLateMinutes, "calculateLateMinutes");
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
        WHEN u.role = 'BOSS/\uC9C0\uC0AC\uC7A5' THEN NULL
        ELSE COALESCE(u.scheduled_start_time, '10:00')
      END AS scheduled_start_time,
      CASE
        WHEN a.status IS NOT NULL THEN a.status
        WHEN l.id IS NOT NULL AND l.status IN ('\uC790\uB3D9 \uC2B9\uC778', '\uC2B9\uC778 \uC644\uB8CC') THEN '\uD734\uBB34'
        ELSE '\uBBF8\uCD9C\uADFC'
      END AS status,
      a.check_in,
      a.check_out,
      a.orders,
      CASE
        WHEN u.role = 'BOSS/\uC9C0\uC0AC\uC7A5' THEN 0
        ELSE COALESCE(a.late, 0)
      END AS late,
      CASE
        WHEN u.role = 'BOSS/\uC9C0\uC0AC\uC7A5' THEN 0
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
      AND l.status IN ('\uC790\uB3D9 \uC2B9\uC778', '\uC2B9\uC778 \uC644\uB8CC')
    WHERE u.is_active = 1
    ORDER BY
      CASE u.role
        WHEN 'BOSS/\uC9C0\uC0AC\uC7A5' THEN 0
        WHEN '\uCD1D\uAD04\uBCF8\uBD80\uC7A5' THEN 1
        WHEN '\uC6B4\uC601\uC2E4\uC7A5' THEN 2
        WHEN '\uC6B4\uC601\uD300\uC7A5' THEN 3
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
  const current = managers.find((row) => Number(row.user_id) === Number(auth.user.id)) || null;
  return json({
    ok: true,
    workDate,
    current,
    managers,
    leaves: leaves.results || []
  });
}
__name(attendanceToday, "attendanceToday");
async function attendanceAction(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.response) return auth.response;
  const body = await request.json();
  const action = String(body.action || "");
  const workDate = attendanceWorkDate();
  const existing = await env.DB.prepare("SELECT * FROM attendance WHERE user_id = ? AND work_date = ?").bind(auth.user.id, workDate).first();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (action === "checkin" || action === "approved_checkin") {
    const approved = action === "approved_checkin" ? 1 : 0;
    const userSchedule = await env.DB.prepare(`
      SELECT role, COALESCE(scheduled_start_time, '10:00') AS scheduled_start_time
      FROM users
      WHERE id = ?
      LIMIT 1
    `).bind(auth.user.id).first();
    const lateMinutes = userSchedule?.role === "BOSS/\uC9C0\uC0AC\uC7A5" || approved ? 0 : calculateLateMinutes(userSchedule?.scheduled_start_time || "10:00");
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
      VALUES (?, ?, '\uADFC\uBB34 \uC911', ?, ?, ?, 0, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, work_date) DO UPDATE SET
        status = '\uADFC\uBB34 \uC911',
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
      reason
    ).run();
  } else if (["meal", "break", "standby", "resume"].includes(action)) {
    if (!existing?.check_in) return json({ message: "\uBA3C\uC800 \uCD9C\uADFC \uCCB4\uD06C\uB97C \uD574\uC8FC\uC138\uC694." }, 409);
    const statusMap = { meal: "\uC2DD\uC0AC\uC911", break: "\uD734\uC2DD", standby: "\uBC30\uC815\uB300\uAE30\uC911", resume: "\uADFC\uBB34 \uC911" };
    await env.DB.prepare("UPDATE attendance SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND work_date = ?").bind(statusMap[action], auth.user.id, workDate).run();
  } else if (action === "checkout") {
    if (!existing?.check_in) return json({ message: "\uBA3C\uC800 \uCD9C\uADFC \uCCB4\uD06C\uB97C \uD574\uC8FC\uC138\uC694." }, 409);
    const orders = Number(body.orders);
    if (!Number.isInteger(orders) || orders < 0) return json({ message: "\uC218\uD589\uAC74\uC218\uB97C 0 \uC774\uC0C1\uC758 \uC22B\uC790\uB85C \uC785\uB825\uD574\uC8FC\uC138\uC694." }, 400);
    await env.DB.prepare("UPDATE attendance SET status='\uD1F4\uADFC', check_out=?, orders=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND work_date=?").bind(now, orders, auth.user.id, workDate).run();
  } else {
    return json({ message: "\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uADFC\uD0DC \uB3D9\uC791\uC785\uB2C8\uB2E4." }, 400);
  }
  return attendanceToday(request, env);
}
__name(attendanceAction, "attendanceAction");
async function attendanceLeave(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.response) return auth.response;
  const body = await request.json();
  const leaveDate = String(body.date || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(leaveDate)) return json({ message: "\uD734\uBB34 \uB0A0\uC9DC\uB97C \uD655\uC778\uD574\uC8FC\uC138\uC694." }, 400);
  const today = attendanceWorkDate();
  const dayDiff = Math.floor((Date.parse(`${leaveDate}T00:00:00+09:00`) - Date.parse(`${today}T00:00:00+09:00`)) / 864e5);
  if (dayDiff < 0) return json({ message: "\uC9C0\uB09C \uB0A0\uC9DC\uC5D0\uB294 \uD734\uBB34\uB97C \uB4F1\uB85D\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 400);
  const status = dayDiff >= 2 ? "\uC790\uB3D9 \uC2B9\uC778" : "\uC2B9\uC778 \uB300\uAE30";
  const memo = String(body.memo || "").trim();
  try {
    await env.DB.prepare(`INSERT INTO leave_requests (user_id, leave_date, reason, memo, status) VALUES (?, ?, '\uC77C\uBC18 \uD734\uBB34', ?, ?)`).bind(auth.user.id, leaveDate, memo || null, status).run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) return json({ message: "\uC774\uBBF8 \uD574\uB2F9 \uB0A0\uC9DC\uC5D0 \uD734\uBB34\uAC00 \uB4F1\uB85D\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4." }, 409);
    throw error;
  }
  return json({ ok: true, status, message: status === "\uC790\uB3D9 \uC2B9\uC778" ? "\uD734\uBB34\uAC00 \uC790\uB3D9 \uC2B9\uC778\uB418\uC5C8\uC2B5\uB2C8\uB2E4." : "\uAE34\uAE09 \uD734\uBB34 \uC2B9\uC778 \uB300\uAE30\uB85C \uB4F1\uB85D\uB418\uC5C8\uC2B5\uB2C8\uB2E4." }, 201);
}
__name(attendanceLeave, "attendanceLeave");
var worker_default = { async fetch(request, env) {
  try {
    await ensureTables(env.DB);
    const url = new URL(request.url);
    const p = url.pathname;
    const m = request.method;
    if (p === "/api/health" && m === "GET") return json({ ok: true, database: true, message: "Worker\uC640 D1 \uC5F0\uACB0\uC774 \uC815\uC0C1\uC785\uB2C8\uB2E4." });
    if (p === "/api/bootstrap/status" && m === "GET") return bootstrapStatus(env);
    if (p === "/api/bootstrap/create" && m === "POST") return bootstrapCreate(request, env);
    if (p === "/api/signup" && m === "POST") return signup(request, env);
    if (p === "/api/login" && m === "POST") return login(request, env);
    if (p === "/api/session" && m === "GET") return session(request, env);
    if (p === "/api/logout" && m === "POST") return logout(request, env);
    if (p === "/api/settings/profile" && m === "PATCH") return updateOwnProfile(request, env);
    if (p === "/api/settings/password" && m === "POST") return changeOwnPassword(request, env);
    if (p === "/api/reader/riders" && m === "POST") return ingestReaderRiders(request, env);
    if (p === "/api/riders" && m === "GET") return listRiders(request, env);
    if (p === "/api/location/update" && m === "POST") return updateLiveLocation(request, env);
    if (p === "/api/live-map/locations" && m === "GET") return listLiveLocations(request, env);
    if (p === "/api/attendance/today" && m === "GET") return attendanceToday(request, env);
    if (p === "/api/attendance/action" && m === "POST") return attendanceAction(request, env);
    if (p === "/api/attendance/leave" && m === "POST") return attendanceLeave(request, env);
    if (p === "/api/admin/users" && m === "GET") return adminUsers(request, env);
    let match = p.match(/^\/api\/admin\/users\/(\d+)$/);
    if (match && m === "PATCH") return updateUser(request, env, Number(match[1]));
    if (match && m === "DELETE") return deletePending(request, env, Number(match[1]));
    match = p.match(/^\/api\/admin\/users\/(\d+)\/suspend$/);
    if (match && m === "PATCH") return changeStatus(request, env, Number(match[1]), 2);
    match = p.match(/^\/api\/admin\/users\/(\d+)\/reactivate$/);
    if (match && m === "PATCH") return changeStatus(request, env, Number(match[1]), 1);
    match = p.match(/^\/api\/admin\/users\/(\d+)\/reset-password$/);
    if (match && m === "POST") return resetPassword(request, env, Number(match[1]));
    if (p.startsWith("/api/live-map/")) {
      const auth = await requireBoss(request, env);
      return auth.response || json({ ok: true });
    }
    if (p.startsWith("/api/")) return json({ message: "API\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." }, 404);
    return env.ASSETS.fetch(request);
  } catch (error) {
    console.error("worker error", error);
    return json({ message: "\uC11C\uBC84 \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4." }, 500);
  }
} };

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-6dm3Hj/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-6dm3Hj/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
