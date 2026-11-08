import { boolean, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

export const rentUnits = pgTable("rent_units", {
  id: text("id").primaryKey(),
  property: text("property").notNull(),
  unitLabel: text("unit_label").notNull(),
  tenantName: text("tenant_name").notNull(),
  tenantEmail: text("tenant_email").notNull().default(""),
  notes: text("notes").notNull().default(""),
  rentCents: integer("rent_cents").notNull(),
  paidCents: integer("paid_cents").notNull().default(0),
  dueDate: text("due_date").notNull(),
  leaseEnd: text("lease_end").notNull(),
}, (table) => [uniqueIndex("rent_units_property_label_idx").on(table.property, table.unitLabel)]);

export const bankImports = pgTable("bank_imports", {
  id: text("id").primaryKey(),
  bankName: text("bank_name").notNull().default("Bank statement"),
  importedAt: text("imported_at").notNull(),
  rowCount: integer("row_count").notNull(),
  skippedCount: integer("skipped_count").notNull().default(0),
});

export const bankTransactions = pgTable("bank_transactions", {
  id: text("id").primaryKey(),
  importId: text("import_id").notNull().references(() => bankImports.id),
  transactionDate: text("transaction_date").notNull(),
  description: text("description").notNull(),
  amountCents: integer("amount_cents").notNull(),
  fingerprint: text("fingerprint").notNull(),
  status: text("status").notNull().default("unplaced"),
  unitId: text("unit_id").references(() => rentUnits.id),
  matchReason: text("match_reason").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("bank_transactions_fingerprint_idx").on(table.fingerprint),
  index("bank_transactions_status_created_idx").on(table.status, table.createdAt),
  index("bank_transactions_date_idx").on(table.transactionDate),
  index("bank_transactions_unit_idx").on(table.unitId),
]);

export const paymentAllocations = pgTable("payment_allocations", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id").notNull().references(() => bankTransactions.id),
  unitId: text("unit_id").notNull().references(() => rentUnits.id),
  amountCents: integer("amount_cents").notNull(),
  createdAt: text("created_at").notNull(),
  undone: boolean("undone").notNull().default(false),
}, (table) => [index("payment_allocations_transaction_undone_idx").on(table.transactionId, table.undone)]);

export const activityEntries = pgTable("activity_entries", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  description: text("description").notNull(),
  transactionId: text("transaction_id").references(() => bankTransactions.id),
  createdAt: text("created_at").notNull(),
  undone: boolean("undone").notNull().default(false),
});

export const reminderDrafts = pgTable("reminder_drafts", {
  id: text("id").primaryKey(),
  unitId: text("unit_id").notNull().references(() => rentUnits.id),
  stage: text("stage").notNull(),
  amountCents: integer("amount_cents").notNull(),
  daysLate: integer("days_late").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("to-send"),
  createdAt: text("created_at").notNull(),
});

export const leaseHistory = pgTable("lease_history", {
  id: text("id").primaryKey(),
  unitId: text("unit_id").notNull().references(() => rentUnits.id),
  tenantName: text("tenant_name").notNull(),
  rentCents: integer("rent_cents").notNull(),
  dueDate: text("due_date").notNull(),
  leaseEnd: text("lease_end").notNull(),
  recordedAt: text("recorded_at").notNull(),
});

export const repairRequests = pgTable("repair_requests", {
  id: text("id").primaryKey(),
  tenantMessage: text("tenant_message").notNull(),
  category: text("category").notNull().default("Needs review"),
  urgency: text("urgency").notNull().default("Routine"),
  suggestedReply: text("suggested_reply").notNull().default(""),
  status: text("status").notNull().default("New"),
  createdAt: text("created_at").notNull(),
});

export const rentSettings = pgTable("rent_settings", {
  id: text("id").primaryKey(),
  landlordName: text("landlord_name").notNull().default(""),
  currencySymbol: text("currency_symbol").notNull().default("$"),
  dateFormat: text("date_format").notNull().default("MMM d, yyyy"),
  timezone: text("timezone").notNull().default("America/Los_Angeles"),
  weekStart: text("week_start").notNull().default("Monday"),
  autoMatch: boolean("auto_match").notNull().default(true),
  friendlyDays: integer("friendly_days").notNull().default(3),
  firmDays: integer("firm_days").notNull().default(7),
  formalDays: integer("formal_days").notNull().default(14),
  friendlyTemplate: text("friendly_template").notNull(),
  firmTemplate: text("firm_template").notNull(),
  formalTemplate: text("formal_template").notNull(),
  scheduleEnabled: boolean("schedule_enabled").notNull().default(true),
  weeklyNote: text("weekly_note").notNull().default(""),
  lastPreparedAt: text("last_prepared_at").notNull().default(""),
});
