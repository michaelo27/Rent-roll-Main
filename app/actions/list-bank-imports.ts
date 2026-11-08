import { defineAction } from "@agent-native/core/action";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "../server/db.js";

export default defineAction({
  description: "List the most recent 50 bank statement imports and the number of imported and duplicate rows.",
  schema: z.object({}),
  outputSchema: z.array(z.object({ id: z.string(), bankName: z.string(), importedAt: z.string(), rowCount: z.number().int(), skippedCount: z.number().int() })),
  http: { method: "GET" },
  run: async () => getDb().select().from(schema.bankImports).orderBy(desc(schema.bankImports.importedAt)).limit(50),
});
