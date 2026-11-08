---
name: weekly-rent-routine
description: Prepare a calm Monday rent brief from saved rent and payment records.
visibility: internal
---

# Weekly rent routine

1. Call `get-brief-data` for expected, collected, still owed, late units, and leases ending soon. Never calculate or restate a balance using your own arithmetic.
2. Call `list-bank-transactions` and `list-activity` to review imported rows, match reasons, and recent changes. Never confirm a suggested match unless the landlord explicitly asks.
3. Call `list-reminders` to see the current neutral drafts. Never send or open an email; those actions belong to the landlord.
4. Write a short, calm note with two or three sentences. Mention only facts in the action results, prioritize exceptions, and avoid legal advice.
5. Save the note and current UTC timestamp with `save-brief`.

The app may import bank statements, record allocations, update rent settings, and change reminder drafts through actions. Money is integer cents and all rent/due/lease dates are date-only ISO strings. The app never moves money or sends messages. If a query fails or a result is missing, say what could not be verified instead of guessing.
