name: reconcile-payments

description: Review unplaced rent payments, propose which unit each belongs to, and wait for the landlord to approve before anything is saved.
visibility: internal

Reconcile payments

Use this when the landlord asks about unmatched payments, the "Needs you" list, or which payment belongs to which unit.

1. Call suggest-payment-matches. It returns every unplaced payment with ranked candidate units, a plain-language reason, and a confidence of high, medium, or low.
2. Report the proposals in plain language, one short line per payment: date, amount, and the unit you think it belongs to with the reason from the action result.
3. Never call confirm-payment-match unless the landlord has explicitly approved that specific payment for that specific unit. Saying "go ahead", "confirm it", or "yes" for one payment is approval for that payment only.
4. Never confirm a low confidence proposal without naming it as a part payment and getting an explicit yes.
5. For payments with no candidate, say plainly that it could not be matched, and offer to mark it as not rent with exclude-bank-payment. Do not guess.
6. Never calculate or restate balances using your own arithmetic. Use only the values returned by the actions.
7. After any confirmations the landlord approved, list what changed, and remind them each one can be undone from the Payments screen.

Money is integer cents and all dates are date-only ISO strings. This app never moves money and never sends messages.
