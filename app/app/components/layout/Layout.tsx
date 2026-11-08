import { AgentSidebar } from "@agent-native/toolkit/app/chat";
import { HeaderActionsProvider } from "@agent-native/toolkit/app-shell";
import { TAB_ID } from "@/lib/tab-id";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <HeaderActionsProvider>
      <AgentSidebar
        position="right"
        storageKey="rent-roll"
        browserTabId={TAB_ID}
        emptyStateText="Ask about your rent roll, payments, or upcoming leases."
        suggestions={["Summarize this week’s rent", "Review the payments I couldn’t place", "Which leases are ending soon?"]}
      >
        <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
          <main className="agent-native-app-main min-w-0 flex-1 overflow-y-auto overscroll-contain">
            {children}
          </main>
        </div>
      </AgentSidebar>
    </HeaderActionsProvider>
  );
}
