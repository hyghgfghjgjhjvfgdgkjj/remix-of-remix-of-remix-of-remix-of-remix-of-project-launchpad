// Pure helpers for desktop account verification, subscription expiry, admin roles, and Luo uploads.

const OWNER_ADMIN_EMAIL = "mainplatform.nexus@gmail.com";
const OWNER_ADMIN_PHONE_EMAIL = "p0760734679@luofilm.site";
const ADMIN_ROLES = new Set(["admin", "staff", "editor"]);
const REVOKED_TOKEN_ERRORS = new Set([
  "TOKEN_EXPIRED",
  "USER_DISABLED",
  "USER_NOT_FOUND",
  "INVALID_REFRESH_TOKEN",
  "INVALID_GRANT",
]);

function fsVal(f) {
  if (!f || typeof f !== "object") return null;
  if ("stringValue" in f) return f.stringValue;
  if ("timestampValue" in f) return f.timestampValue;
  if ("integerValue" in f) return Number(f.integerValue);
  if ("doubleValue" in f) return Number(f.doubleValue);
  if ("booleanValue" in f) return f.booleanValue;
  if ("nullValue" in f) return null;
  return null;
}

function parseFirestoreTime(f) {
  if (!f || typeof f !== "object") return null;
  if ("timestampValue" in f) {
    const ms = Date.parse(String(f.timestampValue));
    return Number.isFinite(ms) ? ms : null;
  }
  if ("stringValue" in f) {
    const s = String(f.stringValue).trim();
    if (!s) return null;
    if (/^\d{10,13}$/.test(s)) {
      const n = Number(s);
      return n > 1e12 ? n : n * 1000;
    }
    const ms = Date.parse(s);
    return Number.isFinite(ms) ? ms : null;
  }
  if ("integerValue" in f || "doubleValue" in f) {
    const n = Number(f.integerValue ?? f.doubleValue);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n > 1e12 ? n : n * 1000;
  }
  const secField = f.mapValue?.fields?.seconds ?? f.mapValue?.fields?._seconds;
  if (secField) {
    const secs = Number(secField.integerValue ?? secField.doubleValue ?? secField.stringValue);
    if (Number.isFinite(secs) && secs > 0) return secs * 1000;
  }
  return null;
}

function parseQueryResult(ok, body) {
  if (!ok || !Array.isArray(body)) return { ok: false, docs: [] };
  if (body.some((row) => row && typeof row === "object" && row.error)) return { ok: false, docs: [] };
  return { ok: true, docs: body.map((row) => row && row.document).filter(Boolean) };
}

function evaluateSubscriptions(docs, nowMs) {
  const active = (docs || [])
    .map((doc) => doc && doc.fields)
    .filter(Boolean)
    .map((f) => {
      const status = String(fsVal(f.status) || "").trim().toLowerCase();
      const expiresMs = parseFirestoreTime(f.expires_at);
      const plan = String(fsVal(f.plan_name) || fsVal(f.tier) || "VIP").trim();
      return { status, expiresMs, expires: expiresMs ? new Date(expiresMs).toISOString() : null, plan };
    })
    .filter((x) => x.status === "active" && (x.expiresMs === null || x.expiresMs > nowMs))
    .sort((a, b) => (b.expiresMs ?? Infinity) - (a.expiresMs ?? Infinity));
  return active[0] || null;
}

function hasAssignedAdminRole(docs) {
  return (docs || []).some((doc) => {
    const role = String(fsVal(doc && doc.fields && doc.fields.role) || "").trim().toLowerCase();
    return ADMIN_ROLES.has(role);
  });
}

function decodeTokenClaims(idToken) {
  try {
    const parts = String(idToken || "").split(".");
    if (parts.length !== 3) return null;
    const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Only trusts claims directly from the Google-issued id_token returned by securetoken. */
function isVerifiedOwnerAdmin(idToken) {
  const claims = decodeTokenClaims(idToken);
  if (!claims || typeof claims.email !== "string") return false;
  const email = claims.email.trim().toLowerCase();
  if (email === OWNER_ADMIN_EMAIL && claims.email_verified === true) return true;
  if (email === OWNER_ADMIN_PHONE_EMAIL) return true;
  return false;
}

function isRevokedTokenError(err) {
  const msg = String(typeof err === "string" ? err : err?.message || err?.error?.message || "").toUpperCase();
  for (const code of REVOKED_TOKEN_ERRORS) if (msg.includes(code)) return true;
  return false;
}

function serverNowMs(headers, fallback = Date.now()) {
  try {
    const h = headers && typeof headers.get === "function" ? headers.get("date") : null;
    const parsed = h ? Date.parse(h) : NaN;
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Combines live Firestore checks with last-verified cache so transient 429 quota
 * errors or wrong PC clocks never wipe an active subscription or admin role.
 */
function mergeAccountState({ user, subsResult, rolesResult, verifiedOwnerAdmin, cached, nowMs }) {
  const sameCached = cached && cached.user && cached.user.uid === user.uid ? cached : null;
  const admin = verifiedOwnerAdmin
    ? true
    : rolesResult.ok
      ? hasAssignedAdminRole(rolesResult.docs)
      : Boolean(sameCached && sameCached.admin);

  let plan = null;
  let expires = null;
  let hasLiveSub = false;
  if (subsResult.ok) {
    const live = evaluateSubscriptions(subsResult.docs, nowMs);
    if (live) {
      hasLiveSub = true;
      plan = live.plan;
      expires = live.expires;
    }
  } else if (sameCached && sameCached.hasLiveSub !== false && sameCached.subscribed && !sameCached.adminOnly) {
    const expMs = sameCached.expires ? Date.parse(sameCached.expires) : null;
    if (expMs === null || (Number.isFinite(expMs) && expMs > nowMs)) {
      hasLiveSub = true;
      plan = sameCached.plan || null;
      expires = sameCached.expires || null;
    }
  }

  const out = {
    user,
    admin,
    subscribed: hasLiveSub || admin,
    hasLiveSub,
    adminOnly: admin && !hasLiveSub,
    plan,
    expires,
    offline: !subsResult.ok && !rolesResult.ok && !verifiedOwnerAdmin,
  };
  const shouldPersist = subsResult.ok || rolesResult.ok || verifiedOwnerAdmin;
  return { out, shouldPersist };
}

function cleanUrl(v) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (s.startsWith("https://")) return s;
  if (s.startsWith("http://")) return "https://" + s.slice(7);
  return null;
}

/** Maps Firestore `media` documents into desktop app upload cards (Luo / Teso / Luganda). */
function mapUploadDocs(docs, lang) {
  const want = lang === "teso" ? "teso" : lang === "luganda" ? "luganda" : "luo";
  return (docs || [])
    .map((doc) => {
      const f = (doc && doc.fields) || {};
      const id = String((doc && doc.name) || "").split("/").pop() || "";
      const published = fsVal(f.published) ?? fsVal(f.is_published) ?? true;
      if (published === false || !id) return null;
      const rawLang = String(fsVal(f.language) || "luo").trim().toLowerCase();
      const normLang = rawLang.startsWith("lug") ? "luganda" : rawLang.startsWith("tes") ? "teso" : "luo";
      if (normLang !== want) return null;
      const kind = String(fsVal(f.kind) || "movie").trim().toLowerCase();
      const poster = cleanUrl(fsVal(f.poster_url)) || cleanUrl(fsVal(f.poster)) || cleanUrl(fsVal(f.thumbnail)) || cleanUrl(fsVal(f.backdrop_url));
      const videoUrl = cleanUrl(fsVal(f.video_url)) || cleanUrl(fsVal(f.stream_url)) || cleanUrl(fsVal(f.url));
      const createdAt = parseFirestoreTime(f.created_at) ?? parseFirestoreTime(f.updated_at) ?? (doc.updateTime ? Date.parse(doc.updateTime) : 0) ?? 0;
      return {
        id: "up-" + id,
        title: String(fsVal(f.title) || fsVal(f.caption) || "Untitled").trim(),
        poster,
        year: Number(fsVal(f.year)) || null,
        genre: String(fsVal(f.genre) || fsVal(f.section) || "").trim(),
        vj: String(fsVal(f.vj) || fsVal(f.actors) || "").trim() || null,
        type: kind === "series" ? "series" : "movie",
        direct: kind === "series" ? null : videoUrl,
        description: String(fsVal(f.description) || "").trim() || null,
        _at: createdAt || 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b._at - a._at)
    .slice(0, 80)
    .map(({ _at, ...item }) => item);
}

module.exports = {
  fsVal,
  parseFirestoreTime,
  parseQueryResult,
  evaluateSubscriptions,
  hasAssignedAdminRole,
  isVerifiedOwnerAdmin,
  isRevokedTokenError,
  serverNowMs,
  mergeAccountState,
  mapUploadDocs,
};