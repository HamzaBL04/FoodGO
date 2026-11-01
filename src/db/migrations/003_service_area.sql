-- FR-32 / BR-17 (ADR-0007): FoodGO serves one area only, Lac 3 / Zone
-- Industrielle Le Kram (LAC3_ZI_KRAM). Every restaurant and every workplace
-- records its zone.
-- The column stays nullable so an existing database still opens; the API
-- requires a zone for every new row, and orders from rows without one are
-- refused (src/domain/serviceArea.js). `npm run seed` rebuilds the demo data
-- with zones.
ALTER TABLE organization ADD COLUMN service_zone TEXT CHECK (service_zone IN ('LAC3_ZI_KRAM'));
ALTER TABLE restaurant ADD COLUMN service_zone TEXT CHECK (service_zone IN ('LAC3_ZI_KRAM'));
