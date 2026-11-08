import { SettingsTabsPage, useAgentSettingsTabs } from "@agent-native/toolkit/app/settings";
import { Link } from "react-router";

export function meta() {
  return [{ title: "Assistant settings · Rent Roll" }];
}

export default function AssistantSettings() {
  const tabs = useAgentSettingsTabs({ appName: "Rent Roll" });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div style={{ padding: "16px 24px" }}><Link to="/?view=settings">← Back to Rent Roll</Link></div>
      <SettingsTabsPage appName="Rent Roll" extraTabs={tabs} defaultTab="agent" />
    </div>
  );
}
