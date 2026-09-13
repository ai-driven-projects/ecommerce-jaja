/*
  Warnings:

  - A unique constraint covering the columns `[alias]` on the table `permissions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `alias` to the `permissions` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "permissions_name_key";

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "alias" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "permissions_alias_key" ON "permissions"("alias");
