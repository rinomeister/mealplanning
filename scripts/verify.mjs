// End-to-end data-layer check against the live database.
// Mirrors what the app's server actions do, then verifies day macros + shopping
// aggregation, and cleans everything up. Run: node scripts/verify.mjs
import pg from "pg";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";

config();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const uid = "test_" + randomUUID();
const tagId = "test_" + randomUUID();
const mealA = "test_" + randomUUID();
const mealB = "test_" + randomUUID();
const day = "2026-06-25";

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ✓ " + msg);
}

async function main() {
  await client.connect();
  console.log("Connected.\n");

  // --- user + tag (tests unique + FK) ---
  await client.query(
    `INSERT INTO "User"(id,email,"passwordHash","updatedAt") VALUES($1,$2,$3,now())`,
    [uid, `${uid}@test.local`, "x"],
  );
  await client.query(
    `INSERT INTO "Tag"(id,"userId",name,color) VALUES($1,$2,'high-protein','#3b82f6')`,
    [tagId, uid],
  );
  console.log("Created user + tag");

  // --- meals + ingredients (hybrid: some with qty/unit, one without) ---
  await client.query(
    `INSERT INTO "Meal"(id,"userId",name,kcal,protein,"updatedAt") VALUES($1,$2,'Oats',350,12,now())`,
    [mealA, uid],
  );
  await client.query(
    `INSERT INTO "Meal"(id,"userId",name,kcal,protein,"updatedAt") VALUES($1,$2,'Snack',200,5,now())`,
    [mealB, uid],
  );
  await client.query(`INSERT INTO "MealTag"("mealId","tagId") VALUES($1,$2)`, [mealA, tagId]);
  await client.query(
    `INSERT INTO "Ingredient"(id,"mealId",name,qty,unit,position) VALUES
      ($1,$2,'milk',500,'ml',0),($3,$2,'oats',60,'g',1)`,
    [randomUUID(), mealA, randomUUID()],
  );
  await client.query(
    `INSERT INTO "Ingredient"(id,"mealId",name,qty,unit,position) VALUES
      ($1,$2,'milk',250,'ml',0),($3,$2,'banana',NULL,NULL,1)`,
    [randomUUID(), mealB, randomUUID()],
  );
  console.log("Created meals + ingredients");

  // --- plan entries (servings multiplier, enum slot/status, DATE column) ---
  await client.query(
    `INSERT INTO "PlanEntry"(id,"userId",date,slot,"mealId",servings,status,position) VALUES
      ($1,$2,$3,'BREAKFAST',$4,2,'PLANNED',0)`,
    [randomUUID(), uid, day, mealA],
  );
  await client.query(
    `INSERT INTO "PlanEntry"(id,"userId",date,slot,"mealId",servings,status,position) VALUES
      ($1,$2,$3,'LUNCH',$4,1,'PLANNED',0)`,
    [randomUUID(), uid, day, mealB],
  );
  // a skipped entry that must NOT count
  await client.query(
    `INSERT INTO "PlanEntry"(id,"userId",date,slot,"mealId",servings,status,position) VALUES
      ($1,$2,$3,'DINNER',$4,5,'SKIPPED',0)`,
    [randomUUID(), uid, day, mealA],
  );
  console.log("Created plan entries\n");

  // --- bodyweight (unique on user+date) ---
  await client.query(
    `INSERT INTO "BodyweightLog"(id,"userId","weightKg","recordedAt") VALUES($1,$2,82.5,$3)`,
    [randomUUID(), uid, day],
  );

  // === Verify day macros (exclude SKIPPED) ===
  console.log("Day macros (excluding skipped):");
  const macros = await client.query(
    `SELECT COALESCE(SUM(m.kcal*p.servings),0) kcal, COALESCE(SUM(m.protein*p.servings),0) protein
     FROM "PlanEntry" p JOIN "Meal" m ON m.id=p."mealId"
     WHERE p."userId"=$1 AND p.date=$2 AND p.status<>'SKIPPED'`,
    [uid, day],
  );
  assert(Number(macros.rows[0].kcal) === 900, `kcal = 900 (got ${macros.rows[0].kcal})`);
  assert(Number(macros.rows[0].protein) === 29, `protein = 29 (got ${macros.rows[0].protein})`);

  // === Verify shopping aggregation (PLANNED only) ===
  console.log("Shopping aggregation (PLANNED only):");
  const shop = await client.query(
    `SELECT i.name, i.unit,
            SUM(i.qty*p.servings) FILTER (WHERE i.qty IS NOT NULL) total,
            bool_or(i.qty IS NULL) has_unquantified
     FROM "PlanEntry" p JOIN "Ingredient" i ON i."mealId"=p."mealId"
     WHERE p."userId"=$1 AND p.date=$2 AND p.status='PLANNED'
     GROUP BY i.name, i.unit ORDER BY i.name`,
    [uid, day],
  );
  const milk = shop.rows.find((r) => r.name === "milk");
  const oats = shop.rows.find((r) => r.name === "oats");
  const banana = shop.rows.find((r) => r.name === "banana");
  assert(milk && Number(milk.total) === 1250, `milk = 1250 ml (got ${milk?.total})`);
  assert(oats && Number(oats.total) === 120, `oats = 120 g (got ${oats?.total})`);
  assert(banana && banana.has_unquantified === true, "banana flagged unquantified");

  console.log("\nAll assertions passed. Cleaning up…");
}

async function cleanup() {
  // FK-safe order.
  await client.query(`DELETE FROM "PlanEntry" WHERE "userId"=$1`, [uid]);
  await client.query(`DELETE FROM "BodyweightLog" WHERE "userId"=$1`, [uid]);
  await client.query(`DELETE FROM "MealTag" WHERE "mealId"=ANY($1)`, [[mealA, mealB]]);
  await client.query(`DELETE FROM "Ingredient" WHERE "mealId"=ANY($1)`, [[mealA, mealB]]);
  await client.query(`DELETE FROM "Meal" WHERE "userId"=$1`, [uid]);
  await client.query(`DELETE FROM "Tag" WHERE "userId"=$1`, [uid]);
  await client.query(`DELETE FROM "User" WHERE id=$1`, [uid]);
  console.log("Cleanup done. DB is empty of test data.");
}

main()
  .catch((e) => {
    console.error("\n" + e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (e) {
      console.error("cleanup error:", e.message);
    }
    await client.end();
  });
