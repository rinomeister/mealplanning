-- Until the redesign, every entry that wasn't SKIPPED counted as eaten, and
-- entries were created as PLANNED. Now PLANNED means "not eaten yet", so past
-- days' PLANNED entries are what they always meant: eaten. Data only.
UPDATE "PlanEntry" SET "status" = 'EATEN'
WHERE "status" = 'PLANNED' AND "date" < CURRENT_DATE;
