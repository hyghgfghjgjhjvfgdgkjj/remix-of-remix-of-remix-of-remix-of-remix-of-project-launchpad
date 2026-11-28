const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseFirestoreTime,
  parseQueryResult,
  evaluateSubscriptions,
  hasAssignedAdminRole,
  isVerifiedOwnerAdmin,
  mergeAccountState,
  mapUploadDocs,
} = require("./account-rules.cjs");

function fakeJwt(payload) {
  const h = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
  const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${h}.${p}.sig`;
}

test("Firestore 429 error array is rejected instead of treated as empty", () => {
  const res = parseQueryResult(false, [{ error: { code: 429, status: "RESOURCE_EXHAUSTED" } }]);
  assert.equal(res.ok, false);
  const res2 = parseQueryResult(true, [{ error: { code: 429, status: "RESOURCE_EXHAUSTED" } }]);
  assert.equal(res2.ok, false);
});

test("active subscription stays active even if local PC clock is years ahead (uses server nowMs)", () => {
  const serverNow = Date.parse("2026-11-28T05:00:00Z");
  const docs = [
    { fields: { status: { stringValue: "active" }, plan_name: { stringValue: "Monthly VIP" }, expires_at: { stringValue: "2026-12-20T00:00:00Z" } } },
  ];
  const live = evaluateSubscriptions(docs, serverNow);
  assert.equal(live?.plan, "Monthly VIP");
});

test("parseFirestoreTime handles ISO strings, epoch numbers, and Timestamp maps", () => {
  assert.equal(parseFirestoreTime({ timestampValue: "2026-12-01T00:00:00Z" }), Date.parse("2026-12-01T00:00:00Z"));
  assert.equal(parseFirestoreTime({ integerValue: "1796083200" }), 1796083200000);
  assert.equal(parseFirestoreTime({ mapValue: { fields: { seconds: { integerValue: "1796083200" } } } }), 1796083200000);
});

test("429 quota outage preserves previously verified subscription and admin status", () => {
  const nowMs = Date.parse("2026-11-28T05:00:00Z");
  const cached = {
    user: { uid: "u1", email: "user@example.com" },
    admin: true,
    subscribed: true,
    hasLiveSub: true,
    plan: "Monthly VIP",
    expires: "2026-12-28T00:00:00Z",
  };
  const { out, shouldPersist } = mergeAccountState({
    user: { uid: "u1", email: "user@example.com" },
    subsResult: { ok: false, docs: [] },
    rolesResult: { ok: false, docs: [] },
    verifiedOwnerAdmin: false,
    cached,
    nowMs,
  });
  assert.equal(out.admin, true);
  assert.equal(out.subscribed, true);
  assert.equal(out.plan, "Monthly VIP");
  assert.equal(shouldPersist, false);
});

test("owner admin is recognized only from verified token claims", () => {
  assert.equal(isVerifiedOwnerAdmin(fakeJwt({ email: "mainplatform.nexus@gmail.com", email_verified: true })), true);
  assert.equal(isVerifiedOwnerAdmin(fakeJwt({ email: "mainplatform.nexus@gmail.com", email_verified: false })), false);
  assert.equal(isVerifiedOwnerAdmin(fakeJwt({ email: "other@gmail.com", email_verified: true })), false);
});

test("assigned admin/staff/editor roles are recognized case-insensitively", () => {
  assert.equal(hasAssignedAdminRole([{ fields: { role: { stringValue: "Admin" } } }]), true);
  assert.equal(hasAssignedAdminRole([{ fields: { role: { stringValue: "staff" } } }]), true);
  assert.equal(hasAssignedAdminRole([{ fields: { role: { stringValue: "user" } } }]), false);
});

test("mapUploadDocs handles legacy Luo movies and series fields", () => {
  const items = mapUploadDocs(
    [
      {
        name: "projects/p/databases/(default)/documents/media/m1",
        fields: {
          caption: { stringValue: "Luo Action" },
          poster_url: { stringValue: "https://cdn.example/p1.jpg" },
          stream_url: { stringValue: "https://cdn.example/v1.mp4" },
          actors: { stringValue: "Senior Paul" },
        },
      },
      {
        name: "projects/p/databases/(default)/documents/media/s1",
        fields: {
          title: { stringValue: "Luo Series" },
          language: { stringValue: "Luo" },
          kind: { stringValue: "series" },
          poster_url: { stringValue: "https://cdn.example/s1.jpg" },
        },
      },
    ],
    "luo",
  );
  assert.equal(items.length, 2);
  const movie = items.find((i) => i.id === "up-m1");
  const series = items.find((i) => i.id === "up-s1");
  assert.equal(movie.title, "Luo Action");
  assert.equal(movie.direct, "https://cdn.example/v1.mp4");
  assert.equal(movie.vj, "Senior Paul");
  assert.equal(series.type, "series");
  assert.equal(series.direct, null);
});