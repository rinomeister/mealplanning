-- AlterTable
ALTER TABLE "Meal" ADD COLUMN     "fiber" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PlanEntry" ADD COLUMN     "grams" DOUBLE PRECISION,
ADD COLUMN     "productId" TEXT,
ALTER COLUMN "mealId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "targetFiber" INTEGER;

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "servingLabel" TEXT,
    "servingGrams" DOUBLE PRECISION,
    "kcal" DOUBLE PRECISION,
    "protein" DOUBLE PRECISION,
    "fat" DOUBLE PRECISION,
    "carbs" DOUBLE PRECISION,
    "fiber" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'openfoodfacts',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");

-- CreateIndex
CREATE INDEX "PlanEntry_productId_idx" ON "PlanEntry"("productId");

-- AddForeignKey
ALTER TABLE "PlanEntry" ADD CONSTRAINT "PlanEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
