UPDATE plans SET "isActive" = true;
UPDATE products SET "isActive" = true WHERE kind IN ('MONTHLY_PLAN', 'YEARLY_PLAN');
SELECT id, title, kind, "priceMinor", "isActive" FROM plans;

