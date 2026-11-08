---
name: month-end
description: Close out the month — propose payment matches, draft reminders for late rents, then save the brief — stopping for approval before anything is written.
visibility: internal
---

# Month-end routine

Work through these steps in order. Stop and report whenever approval is needed.

1. **Reconcile.** Call `suggest-payment-matches`. List each unplaced payment with the unit you believe it belongs to and the reason from that result. Then wait. Do not call `confirm-payment-match` until the landlord approves that specific payment for that specific unit.

2. **Reminders.** Call `get-brief-data`. For every unit in `lateUnits`, draft a reminder from the saved template and save it with `save-reminder-draft`. Never send anything — these are drafts the landlord copies into their own channel. If a draft already exists for that unit and stage, leave it alone unless asked.

3. **Brief.** Write two or three calm sentences about what needs attention, prioritising exceptions, and save it with `save-brief` using the current UTC timestamp.

4. **Report.** Summarise in plain language: how many payments you are proposing to match, how many reminders you drafted, and anything you could not verify.

Rules that always apply:

- Never calculate or restate balances yourself. Use only the values the actions return.
- Never move money.
- Never send, read, or connect to email.
- Never confirm a payment match unless the landlord explicitly approves it.
- If a step fails or a value is missing, say what could not be verified instead of guessing.
