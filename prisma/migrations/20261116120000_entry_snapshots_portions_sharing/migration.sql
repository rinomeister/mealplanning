-- AlterTable
ALTER TABLE "PlanEntry" ADD COLUMN     "carbs" DOUBLE PRECISION,
ADD COLUMN     "fat" DOUBLE PRECISION,
ADD COLUMN     "fiber" DOUBLE PRECISION,
ADD COLUMN     "kcal" DOUBLE PRECISION,
ADD COLUMN     "label" TEXT,
ADD COLUMN     "protein" DOUBLE PRECISION,
ADD COLUMN     "sugar" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ProductPortion" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductPortion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealShare" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "imports" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductPortion_productId_idx" ON "ProductPortion"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "MealShare_code_key" ON "MealShare"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MealShare_mealId_key" ON "MealShare"("mealId");

-- AddForeignKey
ALTER TABLE "ProductPortion" ADD CONSTRAINT "ProductPortion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealShare" ADD CONSTRAINT "MealShare_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: give every existing entry its own copy of the macros it currently
-- resolves to, so editing a meal or product from now on can't rewrite history.
UPDATE "PlanEntry" pe
SET "kcal" = m."kcal", "protein" = m."protein", "fat" = m."fat",
    "carbs" = m."carbs", "sugar" = m."sugar", "fiber" = m."fiber"
FROM "Meal" m
WHERE pe."mealId" = m."id";

UPDATE "PlanEntry" pe
SET "kcal" = p."kcal", "protein" = p."protein", "fat" = p."fat",
    "carbs" = p."carbs", "sugar" = p."sugar", "fiber" = p."fiber"
FROM "Product" p
WHERE pe."productId" = p."id";
