CREATE INDEX "bank_transactions_status_created_idx" ON "bank_transactions" USING btree ("status","created_at");
--> statement-breakpoint
INSERT INTO "bank_imports" ("id", "bank_name", "imported_at", "row_count", "skipped_count") VALUES
('sample-import-nov', 'Sample November statement', '2026-11-02T06:00:00.000Z', 6, 0);
--> statement-breakpoint
INSERT INTO "bank_transactions" ("id", "import_id", "transaction_date", "description", "amount_cents", "fingerprint", "status", "unit_id", "match_reason", "created_at") VALUES
('sample-payment-1a', 'sample-import-nov', '2026-11-01', 'RENT WILLOW 1A', 185000, 'sample-2026-11-01-willow-1a', 'matched', 'unit-1a', 'Reference 1A and exact amount', '2026-11-02T06:00:00.000Z'),
('sample-payment-1b', 'sample-import-nov', '2026-11-01', 'RENT WILLOW 1B', 142500, 'sample-2026-11-01-willow-1b', 'matched', 'unit-1b', 'Reference 1B and exact amount', '2026-11-02T06:00:00.000Z'),
('sample-payment-2a', 'sample-import-nov', '2026-11-01', 'RENT WILLOW 2A', 210000, 'sample-2026-11-01-willow-2a', 'matched', 'unit-2a', 'Reference 2A and exact amount', '2026-11-02T06:00:00.000Z'),
('sample-payment-2b', 'sample-import-nov', '2026-11-01', 'RENT WILLOW 2B', 167500, 'sample-2026-11-01-willow-2b', 'matched', 'unit-2b', 'Reference 2B and exact amount', '2026-11-02T06:00:00.000Z'),
('sample-payment-3a', 'sample-import-nov', '2026-11-01', 'RENT MAPLE 3A', 195000, 'sample-2026-11-01-maple-3a', 'matched', 'unit-3a', 'Reference 3A and exact amount', '2026-11-02T06:00:00.000Z'),
('sample-payment-3b', 'sample-import-nov', '2026-11-01', 'RENT MAPLE 3B', 90000, 'sample-2026-11-01-maple-3b', 'matched', 'unit-3b', 'Reference 3B and exact amount', '2026-11-02T06:00:00.000Z');
--> statement-breakpoint
INSERT INTO "payment_allocations" ("id", "transaction_id", "unit_id", "amount_cents", "created_at") VALUES
('allocation-sample-1a', 'sample-payment-1a', 'unit-1a', 185000, '2026-11-02T06:00:00.000Z'),
('allocation-sample-1b', 'sample-payment-1b', 'unit-1b', 142500, '2026-11-02T06:00:00.000Z'),
('allocation-sample-2a', 'sample-payment-2a', 'unit-2a', 210000, '2026-11-02T06:00:00.000Z'),
('allocation-sample-2b', 'sample-payment-2b', 'unit-2b', 167500, '2026-11-02T06:00:00.000Z'),
('allocation-sample-3a', 'sample-payment-3a', 'unit-3a', 195000, '2026-11-02T06:00:00.000Z'),
('allocation-sample-3b', 'sample-payment-3b', 'unit-3b', 90000, '2026-11-02T06:00:00.000Z');
--> statement-breakpoint
INSERT INTO "activity_entries" ("id", "kind", "description", "transaction_id", "created_at") VALUES
('activity-sample-1a', 'payment-matched', 'Matched automatically: Reference 1A and exact amount', 'sample-payment-1a', '2026-11-02T06:00:00.000Z'),
('activity-sample-1b', 'payment-matched', 'Matched automatically: Reference 1B and exact amount', 'sample-payment-1b', '2026-11-02T06:00:00.000Z'),
('activity-sample-2a', 'payment-matched', 'Matched automatically: Reference 2A and exact amount', 'sample-payment-2a', '2026-11-02T06:00:00.000Z'),
('activity-sample-2b', 'payment-matched', 'Matched automatically: Reference 2B and exact amount', 'sample-payment-2b', '2026-11-02T06:00:00.000Z'),
('activity-sample-3a', 'payment-matched', 'Matched automatically: Reference 3A and exact amount', 'sample-payment-3a', '2026-11-02T06:00:00.000Z'),
('activity-sample-3b', 'payment-matched', 'Matched automatically: Reference 3B and exact amount', 'sample-payment-3b', '2026-11-02T06:00:00.000Z');
