import { getSession, runAuthGuard } from "@agent-native/core/server";
import { defineEventHandler, getRequestURL } from "h3";

// No-login demo mode. Set AUTH_DISABLED=true (or 1) to open the app to anyone
// with the link: no sign-in screen, no owner check. Remove the variable (or set
// it to false) to put the owner sign-in back.
function authDisabled() {
  const value = process.env.AUTH_DISABLED?.trim().toLowerCase();
  return value === "1" || value === "true";
}

// This app has one shared rent roll, not per-user data. Authentication alone
// is not enough: a signed-in account must also be the configured owner.
export default defineEventHandler(async (event) => {
  if (authDisabled()) return;
  const result = await runAuthGuard(event);
  if (result !== undefined) return result;
  const path = getRequestURL(event).pathname;
  // Allow the framework's sign-in, signup, verification and session endpoints.
  if (path.startsWith("/_agent-native/auth/") || path.startsWith("/auth/")) return;
  const owner = process.env.RENT_ROLL_OWNER_EMAIL?.trim().toLowerCase();
  if (!owner) return new Response("Owner access is not configured.", { status: 503 });
  const session = await getSession(event);
  if (session?.email && (session.email.trim().toLowerCase() !== owner || session.emailVerified !== true)) {
    return new Response("This workspace requires the verified owner account.", { status: 403 });
  }
});
