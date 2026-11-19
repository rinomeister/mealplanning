-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aisleOrder" JSONB;

-- CreateTable
CREATE TABLE "ShoppingExtra" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" TEXT,
    "aisle" TEXT,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShoppingExtra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShoppingExtra_userId_idx" ON "ShoppingExtra"("userId");

-- AddForeignKey
ALTER TABLE "ShoppingExtra" ADD CONSTRAINT "ShoppingExtra_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
