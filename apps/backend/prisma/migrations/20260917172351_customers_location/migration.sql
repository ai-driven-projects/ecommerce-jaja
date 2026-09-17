-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- The point of the address is optional, but latitude and longitude always go
-- together: both or none.
ALTER TABLE "customers" ADD CONSTRAINT customers_location_both_or_none CHECK ((latitude IS NULL) = (longitude IS NULL));
