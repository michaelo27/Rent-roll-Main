-- Remove only the original demo rows, leaving owner-created records untouched.
DELETE FROM activity_entries WHERE id IN ('activity-sample-1a','activity-sample-1b','activity-sample-2a','activity-sample-2b','activity-sample-3a','activity-sample-3b');
--> statement-breakpoint
DELETE FROM payment_allocations WHERE id IN ('allocation-sample-1a','allocation-sample-1b','allocation-sample-2a','allocation-sample-2b','allocation-sample-3a','allocation-sample-3b');
--> statement-breakpoint
DELETE FROM bank_transactions WHERE id IN ('sample-payment-1a','sample-payment-1b','sample-payment-2a','sample-payment-2b','sample-payment-3a','sample-payment-3b') AND NOT EXISTS (SELECT 1 FROM payment_allocations WHERE transaction_id = bank_transactions.id) AND NOT EXISTS (SELECT 1 FROM activity_entries WHERE transaction_id = bank_transactions.id);
--> statement-breakpoint
DELETE FROM bank_imports WHERE id = 'sample-import-nov' AND NOT EXISTS (SELECT 1 FROM bank_transactions WHERE import_id = bank_imports.id);
--> statement-breakpoint
DELETE FROM rent_units WHERE id IN ('unit-1a','unit-1b','unit-2a','unit-2b','unit-3a','unit-3b','unit-4a','unit-4b') AND NOT EXISTS (SELECT 1 FROM bank_transactions WHERE unit_id = rent_units.id) AND NOT EXISTS (SELECT 1 FROM payment_allocations WHERE unit_id = rent_units.id) AND NOT EXISTS (SELECT 1 FROM reminder_drafts WHERE unit_id = rent_units.id) AND NOT EXISTS (SELECT 1 FROM lease_history WHERE unit_id = rent_units.id);
--> statement-breakpoint
UPDATE rent_settings SET landlord_name = '' WHERE id = 'default' AND landlord_name = 'Jordan Miller';
