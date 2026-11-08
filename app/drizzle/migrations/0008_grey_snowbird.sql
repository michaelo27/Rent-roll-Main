CREATE INDEX "bank_transactions_date_idx" ON "bank_transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "bank_transactions_unit_idx" ON "bank_transactions" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_transaction_undone_idx" ON "payment_allocations" USING btree ("transaction_id","undone");