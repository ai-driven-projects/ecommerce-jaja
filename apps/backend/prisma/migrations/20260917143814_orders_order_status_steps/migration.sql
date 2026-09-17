-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "delivered_at" TIMESTAMP(3),
ADD COLUMN     "out_for_delivery_at" TIMESTAMP(3),
ADD COLUMN     "payment_approved_at" TIMESTAMP(3),
ADD COLUMN     "picking_started_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "orders_status_placed_at_idx" ON "orders"("status", "placed_at");
