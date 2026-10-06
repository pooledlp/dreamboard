# Contributing

Use `feat/<topic>`, `fix/<topic>`, or `docs/<topic>` branches and a focused pull request. Commit prefixes: feat, fix, docs, test, chore.

Run `npm run check` and `npm test`. Review UI changes in desktop and narrow browser layouts. Add meaningful tests for domain behavior, failure handling, and persistence changes.

Naming: DreamProtocol is the product family; Dreamboard is this operations workspace; Dreamworkforce is the specialist work layer; AI Receptionist is the intake interface. Repository: `dreamboard`. Package: `@dreamprotocol/dreamboard`. Files use lowercase kebab-case.

Keep workflow decisions in `src/domain.mjs`, storage in `src/store.mjs`, and HTTP concerns in `server.mjs`. Render user-controlled content with textContent. Keep sample data fictional and explicitly labeled.

Do not commit local data, credentials, personal records, or invented customer metrics. New external actions need explicit authorization boundaries, idempotency, failure handling, and review.

