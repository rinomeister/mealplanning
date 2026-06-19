// Full-stack runtime check: create a user, log in through the real HTTP auth
// flow (Auth.js -> Prisma -> bcrypt), load a Prisma-backed page, then clean up.
// Requires the dev/prod server running on :3000. Run: node scripts/verify-app.mjs
import pg from "pg";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";

config();

const BASE = "http://localhost:3000";
const email = `test_${randomUUID()}@test.local`;
const password = "supersecret123";
const uid = "test_" + randomUUID();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const jar = new Map();
function store(res) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
}
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ✓ " + msg);
}

async function main() {
  await client.connect();

  // Seed a user the way registration does (hashed password).
  const hash = await bcrypt.hash(password, 10);
  await client.query(
    `INSERT INTO "User"(id,email,"passwordHash",name,"updatedAt") VALUES($1,$2,$3,'Tester',now())`,
    [uid, email, hash],
  );
  console.log("Seeded user:", email);

  // 1) CSRF token
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  store(csrfRes);
  const { csrfToken } = await csrfRes.json();
  assert(!!csrfToken, "got CSRF token");

  // 2) Credentials sign-in
  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${BASE}/`,
  });
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(),
    },
    body,
    redirect: "manual",
  });
  store(loginRes);
  const hasSession = [...jar.keys()].some((k) => k.includes("session-token"));
  assert(hasSession, `session cookie set (login OK, status ${loginRes.status})`);

  // 3) Load the Prisma-backed dashboard as the logged-in user
  const dash = await fetch(`${BASE}/`, {
    headers: { cookie: cookieHeader() },
    redirect: "manual",
  });
  const html = await dash.text();
  assert(dash.status === 200, `dashboard returned 200 (got ${dash.status})`);
  // findUniqueOrThrow runs on this page, so a 200 already proves the Prisma read.
  assert(html.includes("Tester"), "dashboard shows the logged-in user's name (Prisma read OK)");
  assert(/meals saved/.test(html), "dashboard rendered its data widgets");

  // 4) Wrong password must be rejected
  const badBody = new URLSearchParams({ csrfToken, email, password: "wrong", callbackUrl: `${BASE}/` });
  const badRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body: badBody,
    redirect: "manual",
  });
  const loc = badRes.headers.get("location") ?? "";
  assert(/error/i.test(loc) || badRes.status >= 400, `wrong password rejected (loc: ${loc || badRes.status})`);

  console.log("\nFull-stack auth + Prisma flow verified.");
}

main()
  .catch((e) => {
    console.error("\n" + e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.query(`DELETE FROM "User" WHERE id=$1`, [uid]);
    await client.end();
    console.log("Cleaned up test user.");
  });
