-- AlterTable
ALTER TABLE "Meal" ADD COLUMN     "cookedGrams" DOUBLE PRECISION,
ADD COLUMN     "favorite" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ShoppingCheck" ADD COLUMN     "atHome" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProductFavorite" (
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFavorite_pkey" PRIMARY KEY ("userId","productId")
);

-- CreateTable
CREATE TABLE "ShoppingAisle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aisle" TEXT NOT NULL,

    CONSTRAINT "ShoppingAisle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductFavorite_productId_idx" ON "ProductFavorite"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingAisle_userId_name_key" ON "ShoppingAisle"("userId", "name");

-- AddForeignKey
ALTER TABLE "ProductFavorite" ADD CONSTRAINT "ProductFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFavorite" ADD CONSTRAINT "ProductFavorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingAisle" ADD CONSTRAINT "ShoppingAisle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

