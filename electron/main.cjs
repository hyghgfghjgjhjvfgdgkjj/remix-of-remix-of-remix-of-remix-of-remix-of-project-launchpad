// Movie max desktop: standalone app UI (renderer/) with its own frameless window.
// Data comes from the active MovieMax domain (Firebase), cached for offline start.
const { app, BrowserWindow, ipcMain, net, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { matchDownload, downloadFilename } = require("./download-rules.cjs");
const {
  fsVal,
  parseQueryResult,
  isVerifiedOwnerAdmin,
  isRevokedTokenError,
  serverNowMs,
  mergeAccountState,
  mapUploadDocs,
} = require("./account-rules.cjs");

const DEFAULT_SITE = "https://luofilm.site";
const ACTIVE_SITE_DOC = "https://firestore.googleapis.com/v1/projects/luo-film-2026/databases/(default)/documents/app_settings/active_site?key=AIzaSyBTSFk7GSITIHQ9WxSdi1BoVvcr4FXuZe0";
const file = (n) => path.join(app.getPath("userData"), n);
const readJson = (n, d) => { try { return JSON.parse(fs.readFileSync(file(n), "utf8")); } catch { return d; } };
const timeout = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };

let site = null;
async function activeSite() {
  if (site) return site;
  try {
    const doc = await (await net.fetch(ACTIVE_SITE_DOC, { signal: timeout(4000) })).json();
    const u = new URL(doc.fields.value.stringValue);
    if (u.protocol === "https:") { site = u.origin; fs.writeFileSync(file("site.json"), JSON.stringify({ site })); return site; }
  } catch {}
  site = readJson("site.json", {}).site || DEFAULT_SITE;
  return site;
}

ipcMain.handle("feed", async () => {
  const s = await activeSite();
  try {
    const res = await fetch(`${s}/api/public/app-latest`, { signal: timeout(20000) });
    const body = await res.json();
    if (Array.isArray(body.items) && body.items.length) {
      const data = { at: Date.now(), site: s, items: body.items };
      fs.writeFileSync(file("feed.json"), JSON.stringify(data));
      return { ...data, offline: false };
    }
  } catch {}
  const cached = readJson("feed.json", null);
  return cached ? { ...cached, offline: true } : { items: [], site: s, offline: true };
});

async function directUploads(lang) {
  const docs = [];
  let pageToken = "";
  const headers = idToken?.token ? { authorization: `Bearer ${idToken.token}` } : {};
  try {
    for (let i = 0; i < 10; i++) {
      const u = `${FS}/media?key=${FB_KEY}&pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
      const res = await net.fetch(u, { headers, signal: timeout(12000) });
      if (!res.ok) break;
      const body = await res.json();
      if (Array.isArray(body.documents)) docs.push(...body.documents);
      if (!body.nextPageToken) break;
      pageToken = body.nextPageToken;
    }
  } catch {}
  return mapUploadDocs(docs, lang);
}

async function directUploadTitle(rawId) {
  const headers = idToken?.token ? { authorization: `Bearer ${idToken.token}` } : {};
  try {
    const res = await net.fetch(`${FS}/media/${encodeURIComponent(rawId)}?key=${FB_KEY}`, { headers, signal: timeout(10000) });
    if (!res.ok) return null;
    const doc = await res.json();
    const [item] = mapUploadDocs([doc], (fsVal(doc.fields?.language) || "luo").toLowerCase());
    if (!item) return null;
    const q = async (fieldPath) => {
      const r = await net.fetch(`${FS}:runQuery?key=${FB_KEY}`, { method: "POST", headers: { ...headers, "content-type": "application/json" }, signal: timeout(10000),
        body: JSON.stringify({ structuredQuery: { from: [{ collectionId: "episodes" }], where: { fieldFilter: { field: { fieldPath }, op: "EQUAL", value: { stringValue: rawId } } } } }) });
      return parseQueryResult(r.ok, await r.json().catch(() => null)).docs;
    };
    let epDocs = await q("title_id"); if (!epDocs.length) epDocs = await q("media_id");
    const episodes = epDocs.map((d) => ({ season: Number(fsVal(d.fields?.season)) || 1, episode: Number(fsVal(d.fields?.episode) ?? fsVal(d.fields?.episode_number)) || 1, title: fsVal(d.fields?.name) || fsVal(d.fields?.title) || null, url: fsVal(d.fields?.video_url) || fsVal(d.fields?.url) || null })).filter((e) => e.url).sort((a, b) => a.season - b.season || a.episode - b.episode);
    return { id: item.id, title: item.title, description: item.description, poster: item.poster, backdrop: item.poster, year: item.year, genre: item.genre, vj: item.vj, seasons: [], luganda: { url: item.direct, episodes } };
  } catch { return null; }
}

ipcMain.handle("api", async (_e, p) => {
  if (typeof p !== "string" || !/^[\w\-/?=&%.]+$/.test(p)) return { error: "bad" };
  const s = await activeSite();
  const key = "c-" + p.replace(/[^\w]/g, "_").slice(0, 120) + ".json";
  // Try the active site, then the built-in domain, using Chromium's network stack (system proxy/certs).
  for (const base of [...new Set([s, DEFAULT_SITE, "https://www.luofilm.site"])]) {
    try {
      const res = await net.fetch(`${base}/api/public/desktop/${p}`, { signal: timeout(25000) });
      if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) continue;
      const body = await res.json();
      if (base !== s) { site = base; fs.writeFileSync(file("site.json"), JSON.stringify({ site })); }
      if (p.startsWith("uploads/") && !body.items?.length) {
        const direct = await directUploads(p.slice(8).split("?")[0]);
        if (direct.length) { const out = { items: direct }; fs.writeFileSync(file(key), JSON.stringify(out)); return out; }
        const c = readJson(key, null);
        return c?.items?.length ? { ...c, offline: true } : { items: [], quota: true };
      }
      if (p.startsWith("title/up-") && body.error) {
        const direct = await directUploadTitle(p.slice(9).split("?")[0]);
        if (direct) { fs.writeFileSync(file(key), JSON.stringify(direct)); return direct; }
      }
      fs.writeFileSync(file(key), JSON.stringify(body)); return body;
    } catch {}
  }
  if (p.startsWith("uploads/")) {
    const direct = await directUploads(p.slice(8).split("?")[0]);
    if (direct.length) { const out = { items: direct }; fs.writeFileSync(file(key), JSON.stringify(out)); return out; }
  }
  if (p.startsWith("title/up-")) {
    const direct = await directUploadTitle(p.slice(9).split("?")[0]);
    if (direct) { fs.writeFileSync(file(key), JSON.stringify(direct)); return direct; }
  }
  const c = readJson(key, null);
  return c ? { ...c, offline: true } : { offline: true };
});

const FS = "https://firestore.googleapis.com/v1/projects/luo-film-2026/databases/(default)/documents";
// Provider checkout and activation use the same authenticated flow as the website.
let idToken = null;
let clockOffset = 0;
const FB_KEY = "AIzaSyBTSFk7GSITIHQ9WxSdi1BoVvcr4FXuZe0";
const READ_USER = `new Promise((ok) => { const r = indexedDB.open("firebaseLocalStorageDb"); r.onerror = () => ok(null);
  r.onsuccess = () => { try { const q = r.result.transaction("firebaseLocalStorage").objectStore("firebaseLocalStorage").getAll();
  q.onsuccess = () => { const u = (q.result || []).map((x) => x.value).find((v) => v && v.uid && v.stsTokenManager); ok(u ? { uid: u.uid, email: u.email, name: u.displayName, photo: u.photoURL, refreshToken: u.stsTokenManager.refreshToken, firebaseUser: u } : null); };
  q.onerror = () => ok(null); } catch { ok(null); } }; })`;
const notifyAccount = () => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("account-changed"));
async function fsQuery(token, collectionId, fieldPath, value) {
  try {
    const res = await net.fetch(`${FS}:runQuery?key=${FB_KEY}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      signal: timeout(10000),
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId }], where: { fieldFilter: { field: { fieldPath }, op: "EQUAL", value: { stringValue: value } } } } }),
    });
    return { ...parseQueryResult(res.ok, await res.json().catch(() => null)), nowMs: serverNowMs(res.headers, 0) };
  } catch {
    return { ok: false, docs: [], nowMs: 0 };
  }
}
async function account() {
  const acc = readJson("account.json", null); if (!acc?.refreshToken) return { user: null };
  const user = { uid: acc.uid, email: acc.email, name: acc.name, photo: acc.photo };
  const cached = readJson("sub.json", null);
  try {
    const tokenRes = await net.fetch(`https://securetoken.googleapis.com/v1/token?key=${FB_KEY}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(acc.refreshToken)}`, signal: timeout(10000) });
    const t = await tokenRes.json().catch(() => ({}));
    const nowMs = serverNowMs(tokenRes.headers, Date.now() + clockOffset);
    if (tokenRes.headers.get("date")) clockOffset = nowMs - Date.now();
    if (!t.id_token) {
      if (t.error && isRevokedTokenError(t.error)) { fs.rmSync(file("account.json"), { force: true }); fs.rmSync(file("sub.json"), { force: true }); return { user: null }; }
      throw new Error("token unavailable");
    }
    const uid = t.user_id || acc.uid;
    user.uid = uid;
    if (t.refresh_token && t.refresh_token !== acc.refreshToken) fs.writeFileSync(file("account.json"), JSON.stringify({ ...acc, uid, refreshToken: t.refresh_token }));
    idToken = { uid, token: t.id_token, at: Date.now() };
    const verifiedOwnerAdmin = isVerifiedOwnerAdmin(t.id_token);
    const [subsResult, rolesResult] = await Promise.all([
      fsQuery(t.id_token, "luo_subscriptions", "user_id", uid),
      verifiedOwnerAdmin ? Promise.resolve({ ok: true, docs: [], nowMs: 0 }) : fsQuery(t.id_token, "user_roles", "user_id", uid),
    ]);
    // Also support user_roles docs keyed directly by uid when the query returned no rows.
    if (!verifiedOwnerAdmin && rolesResult.ok && !rolesResult.docs.length) {
      try {
        const direct = await net.fetch(`${FS}/user_roles/${encodeURIComponent(uid)}?key=${FB_KEY}`, { headers: { authorization: `Bearer ${t.id_token}` }, signal: timeout(6000) });
        if (direct.ok) { const doc = await direct.json(); if (doc?.fields) rolesResult.docs.push(doc); }
      } catch {}
    }
    const checkNow = subsResult.nowMs || rolesResult.nowMs || nowMs;
    const { out, shouldPersist } = mergeAccountState({ user, subsResult, rolesResult, verifiedOwnerAdmin, cached, nowMs: checkNow });
    if (shouldPersist) fs.writeFileSync(file("sub.json"), JSON.stringify(out));
    return out;
  } catch {
    const { out } = mergeAccountState({ user, subsResult: { ok: false, docs: [] }, rolesResult: { ok: false, docs: [] }, verifiedOwnerAdmin: false, cached, nowMs: Date.now() + clockOffset });
    return out;
  }
}
ipcMain.handle("account", () => account());
ipcMain.handle("logout", async () => {
  fs.rmSync(file("account.json"), { force: true }); fs.rmSync(file("sub.json"), { force: true });
  const s = await activeSite(); const w = new BrowserWindow({ show: false });
  await w.loadURL(s + "/profile").catch(() => {}); await w.webContents.executeJavaScript(`indexedDB.deleteDatabase("firebaseLocalStorageDb")`).catch(() => {}); w.destroy();
});

const AUTH_ERR = { EMAIL_NOT_FOUND: "No account with that email", INVALID_PASSWORD: "Wrong password", INVALID_LOGIN_CREDENTIALS: "Wrong email or password", EMAIL_EXISTS: "That email already has an account", USER_DISABLED: "This account is disabled", TOO_MANY_ATTEMPTS_TRY_LATER: "Too many tries, wait a moment" };
ipcMain.handle("email-auth", async (_e, o) => {
  const email = String(o?.email || "").slice(0, 200), password = String(o?.password || "").slice(0, 200);
  const call = async (ep, body) => (await net.fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${ep}?key=${FB_KEY}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: timeout(15000) })).json();
  try {
    if (o?.mode === "reset") { const r = await call("sendOobCode", { requestType: "PASSWORD_RESET", email }); return r.error ? { error: AUTH_ERR[r.error.message] || "Could not send reset email" } : { ok: true }; }
    const r = await call(o?.mode === "up" ? "signUp" : "signInWithPassword", { email, password, returnSecureToken: true });
    if (r.error) { const k = String(r.error.message).split(" ")[0]; return { error: AUTH_ERR[k] || (k.startsWith("WEAK_PASSWORD") ? "Password must be at least 6 characters" : "Sign-in failed") }; }
    let name = r.displayName || "";
    if (o?.mode === "up" && o.name) { await call("update", { idToken: r.idToken, displayName: String(o.name).slice(0, 80) }).catch(() => {}); name = o.name; }
    fs.writeFileSync(file("account.json"), JSON.stringify({ uid: r.localId, email: r.email, name, photo: r.profilePicture || null, refreshToken: r.refreshToken, firebaseUser: { uid: r.localId, email: r.email, displayName: name, photoURL: r.profilePicture || null, emailVerified: false, apiKey: FB_KEY, appName: "[DEFAULT]", providerData: [{ providerId: "password", uid: r.email, email: r.email, displayName: name, photoURL: null }], stsTokenManager: { refreshToken: r.refreshToken, accessToken: r.idToken, expirationTime: Date.now() + Number(r.expiresIn || 3600) * 1000 } } }));
    notifyAccount(); return { ok: true };
  } catch { return { error: "No connection to the sign-in service" }; }
});

let login = null;
const normHost = (h) => String(h || "").toLowerCase().replace(/^www\./, "");
function trustedAccountSender(e) {
  if (!login || login.isDestroyed() || e.sender !== login.webContents) return false;
  try { const u = new URL(e.sender.getURL()); const s = new URL(site || DEFAULT_SITE); return u.protocol === "https:" && normHost(u.hostname) === normHost(s.hostname) && u.pathname === "/desktop-account"; } catch { return false; }
}
ipcMain.handle("desktop-session", (e) => trustedAccountSender(e) ? readJson("account.json", null)?.firebaseUser || null : null);
ipcMain.handle("desktop-ready", async (e) => {
  if (!trustedAccountSender(e)) return;
  const u = await e.sender.executeJavaScript(READ_USER).catch(() => null);
  if (!u?.refreshToken) return;
  fs.writeFileSync(file("account.json"), JSON.stringify(u));
  await account(); notifyAccount(); login?.close();
});
ipcMain.on("desktop-close", (e) => { if (trustedAccountSender(e)) login?.close(); });
ipcMain.handle("login", async (e, p) => {
  const s = await activeSite();
  const parent = BrowserWindow.fromWebContents(e.sender);
  if (!login || login.isDestroyed()) {
    login = new BrowserWindow({ parent, modal: true, width: p === "/plans" ? 850 : 480, height: 760, resizable: true, backgroundColor: "#101217", title: "Movie max", autoHideMenuBar: true, icon: path.join(__dirname, "icon.ico"),
      webPreferences: { preload: path.join(__dirname, "account-preload.cjs"), contextIsolation: true, nodeIntegration: false } });
    login.on("closed", () => { account().then(notifyAccount).catch(() => {}); });
    login.webContents.setWindowOpenHandler(({ url }) => {
      try { const u = new URL(url); if (u.protocol === "https:" && /(^|\.)(accounts.google.com|whop.com|paypal.com)$/.test(u.hostname)) return { action: "allow" }; } catch {}
      return { action: "deny" };
    });
  }
  // Only the dedicated account/checkout screen: never /profile or a website page.
  await login.loadURL(s + "/desktop-account?action=" + (p === "/plans" ? "plans" : "google"));
  login.show();
});

const dls = new Map(); let dlSeq = Date.now();
const dlInfo = () => [...dls.values()].map(({ item, last, ...d }) => ({ ...d, received: item?.getReceivedBytes() ?? d.received, total: item?.getTotalBytes() || d.total, paused: item?.isPaused() ?? false }));
const pushDl = () => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("dl", dlInfo()));
ipcMain.handle("dl-start", (e, { url, name, poster }) => {
  if (!/^https:\/\//.test(url) && !/^http:\/\/localhost/.test(url)) return;
  const id = ++dlSeq; dls.set(id, { id, name, poster, url, state: "starting", received: 0, total: 0, speed: 0 });
  pendingDl.push(id); e.sender.downloadURL(url); pushDl();
});
const pendingDl = [];
ipcMain.handle("dl-list", () => dlInfo());
ipcMain.handle("dl-all", (_e, a) => { for (const d of dls.values()) { if (a === "pause") d.item?.pause(); if (a === "resume" && d.item?.canResume()) d.item.resume(); if (a === "clear" && (d.state === "done" || d.state === "failed")) dls.delete(d.id); } pushDl(); });
ipcMain.handle("dl-folder", () => { const dir = path.join(app.getPath("videos"), "Movie max"); fs.mkdirSync(dir, { recursive: true }); shell.openPath(dir); });
ipcMain.handle("dl-act", (_e, { id, a }) => {
  const d = dls.get(id); if (!d) return;
  if (a === "pause") d.item?.pause(); else if (a === "resume") d.item?.canResume() && d.item.resume();
  else if (a === "cancel") { d.item?.cancel(); dls.delete(id); } else if (a === "open" && d.path) shell.showItemInFolder(d.path);
  else if (a === "remove") dls.delete(id);
  else if (a === "delete") { if (d.path) fs.rmSync(d.path, { force: true }); dls.delete(id); }
  else if (a === "retry" && d.url) { Object.assign(d, { state: "starting", received: 0, total: 0, speed: 0 }); pendingDl.push(id); BrowserWindow.getAllWindows()[0]?.webContents.downloadURL(d.url); }
  pushDl();
});
// A wrong PC clock makes valid certificates look expired; accept only that error, only for our own services, and tell the user once.
const OUR_HOSTS = /(^|\.)(luofilm\.site|googleapis\.com|aoneroom\.com|r2\.dev|workers\.dev|deno\.dev|netlify\.app)$/;
let clockWarned = false;
app.whenReady().then(() => require("electron").session.defaultSession.setCertificateVerifyProc((req, cb) => {
  if (req.verificationResult === "net::ERR_CERT_DATE_INVALID" && OUR_HOSTS.test(req.hostname)) {
    if (!clockWarned) { clockWarned = true; setTimeout(() => BrowserWindow.getAllWindows().forEach((w) => w.webContents.send("clock-wrong")), 1500); }
    return cb(0);
  }
  cb(-3);
}));
app.whenReady().then(() => require("electron").session.defaultSession.on("will-download", (_e, item) => {
  const d = matchDownload(pendingDl, dls, item.getURLChain()); if (!d) return;
  const dir = path.join(app.getPath("videos"), "Movie max"); fs.mkdirSync(dir, { recursive: true });
  d.path = path.join(dir, downloadFilename(item.getFilename(), d.id)); item.setSavePath(d.path); d.item = item; d.state = "downloading";
  let t = 0; item.on("updated", (_ev, st) => { d.state = st === "interrupted" ? "paused" : "downloading"; const now = Date.now(); if (now - t > 700) { const b = item.getReceivedBytes(); d.speed = d.last ? Math.max(0, (b - d.last.b) / ((now - d.last.t) / 1000)) : 0; d.last = { b, t: now }; t = now; pushDl(); } });
  item.once("done", (_ev, st) => { d.received = item.getReceivedBytes(); d.total = item.getTotalBytes(); d.item = null; d.state = st === "completed" ? "done" : "failed"; pushDl(); });
}));

let player = null;
ipcMain.handle("watch", async (_e, p) => {
  const s = await activeSite();
  if (typeof p !== "string" || !p.startsWith("/")) return;
  if (!player || player.isDestroyed()) {
    player = new BrowserWindow({ width: 1200, height: 720, backgroundColor: "#07080c", title: "Movie max Player", autoHideMenuBar: true, icon: path.join(__dirname, "icon.ico") });
    player.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  }
  player.loadURL(s + p); player.show(); player.focus();
});
ipcMain.handle("open", async (_e, p) => { const s = await activeSite(); shell.openExternal(/^https?:/.test(p) ? p : s + p); });
ipcMain.on("win", (e, a) => {
  const w = BrowserWindow.fromWebContents(e.sender); if (!w) return;
  if (a === "min") w.minimize(); else if (a === "max") w.isMaximized() ? w.unmaximize() : w.maximize(); else w.close();
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1240, height: 780, minWidth: 960, minHeight: 600, frame: false, backgroundColor: "#0b0c10", title: "Movie max",
    icon: path.join(__dirname, "icon.ico"),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, webviewTag: false },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

if (!app.requestSingleInstanceLock()) app.exit(0);
app.on("second-instance", () => { const [w] = BrowserWindow.getAllWindows(); if (w?.isMinimized()) w.restore(); w?.focus(); });
app.on("window-all-closed", () => app.quit());
app.whenReady().then(createWindow);
