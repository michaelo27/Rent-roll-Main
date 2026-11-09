import { defineAgentNativeConfig } from "@agent-native/core/config";

export default defineAgentNativeConfig({
  changelog: { enabled: false },
  harness: true,
  onboarding: { firstRun: "off" },
  runtime: { auth: { enabled: false } },
});