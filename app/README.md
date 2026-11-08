# Rent Roll

A rent-roll workspace for independent landlords. Add units, review bank CSVs, and prepare reminders. Rent Roll does not move money or deliver reminders.

## Local demo

Requires Node 22.22 or newer and pnpm 10. Install dependencies and run the migrations for an isolated demo database:

```sh
corepack enable
pnpm install
DATABASE_URL=pglite:./data/demo pnpm db:migrate
DATABASE_URL=pglite:./data/demo AUTH_DISABLED=true HOST=0.0.0.0 PORT=8080 pnpm dev --host 0.0.0.0
```

The scaffold's `AUTH_DISABLED` local single-user mode is only for development and demos. The demo database starts empty; use synthetic data only. Never expose this mode as a production service or enter real tenant information. `.env` files and `data/` are ignored by Git. Database migrations remove the original sample rows without deleting owner-created records.

## Email and privacy

Rent Roll does not need an email connection. A tenant email address is optional and only supplies a prefilled `mailto:` link in the landlord's own mail app. No link is shown when no address is supplied. Reminders can be copied for SMS, chat, printing, or another channel. The assistant's scaffold email tool is disabled. CSV exports are generated in the browser and saved locally by the browser.

Use only synthetic tenant data in the repository, demo, and Clips video. Do not commit `.env` files or local databases. The weekly routine drafts a note and does not send messages; the local scheduler is off by default. Assistant features require a configured AI provider; open Settings → The assistant → Set up AI model. Deterministic rent and payment features do not.

## Unverified

- The scaffold includes authentication, but production sign-in and single-owner authorization have not been verified end to end for deployment. The current production guard expects `RENT_ROLL_OWNER_EMAIL` and a verified session; its compatibility with all scaffold routes and agent channels needs a security review.
- The scaffold's production authentication may require email verification and an email delivery provider depending on configuration. This has not been deployed or verified; no custom login, verification, or password-reset flow was built. Configure or select a scaffold-supported authentication method that meets the no-email requirement before production.
- A production deployment needs a persistent PostgreSQL database, authentication configuration, HTTPS, backups, and a stable secret. Do not use the local demo database for real data.
- AI-provider configuration, scheduled jobs, and a Clips recording have not been verified in this demo.

## Project layout

- `app/`: routes and screens
- `actions/`: operations shared by the UI and assistant
- `server/`: database client and scaffold plugins
- `drizzle/`: schema and migrations
- `jobs/`: scheduled agent routines
