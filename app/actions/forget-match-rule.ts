import { defineAction } from "@agent-native/core/action";
import { z } from "zod";
import { forgetMatchRule } from "../server/match-rules.js";

export default defineAction({
  description: "Forget one learned payment wording so future imports stop matching it to that unit.",
  schema: z.object({
    unitId: z.string().describe("Unit the wording was learned for"),
    pattern: z.string().trim().min(1).describe("The learned wording to forget"),
  }),
  outputSchema: z.object({ unitId: z.string(), pattern: z.string(), forgotten: z.boolean() }),
  run: async ({ unitId, pattern }) => {
    await forgetMatchRule(unitId, pattern);
    return { unitId, pattern, forgotten: true };
  },
});
