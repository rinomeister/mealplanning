-- AlterTable
ALTER TABLE "Meal" ADD COLUMN     "sugar" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "sugar" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "targetSugar" INTEGER;
