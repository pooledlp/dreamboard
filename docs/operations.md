# Operations and production readiness

## Local start and storage

Run `npm start` with Node.js 22 or newer. The app writes `data/workspace.json`. The directory and local environment files are excluded from Git.

Use only one server process per data directory. To stop, interrupt the foreground process. A port conflict is reported at startup; choose another PORT in the local environment.

## Backup and restore

Use **Integrations → Export workspace** to download a JSON snapshot containing tasks, events, and receipts. Treat the export as potentially sensitive if you entered personal information.

For local restore: stop the server, preserve a copy of the current workspace file, validate the export's schema version and arrays, then copy the verified export to `data/workspace.json`. Start the server and inspect task counts and recent activity. The extra exportedAt field is informational. There is no automatic restore UI or migration tooling.

A malformed or incompatible file fails startup rather than resetting the workspace.

## Failure handling

- A failed write returns an error and leaves committed state unchanged.
- A stale edit returns 409; refresh and review instead of retrying blindly.
- A conflicting intake ID returns 409; investigate the upstream identity contract.
- A safe replay returns the existing task and increments its receipt count.
- If saving succeeds but the browser cannot refresh, refresh the page. Reusing the same submission ID will not create a second task.
- Application logs record error classes/codes rather than task descriptions.

## Before real customer use

1. Add authenticated users, tenant isolation, role-based permissions, and verified reviewer identity.
2. Replace the local file store with a transactional database, unique intake constraints, migrations, backups, and recovery testing.
3. Add pagination, indexing, retention, archival, and workload-scale tests.
4. Protect integrations with signed requests or scoped service credentials and replay windows.
5. Implement a worker queue with explicit tool permissions, delivery receipts, retry limits, and dead-letter review.
6. Add monitoring, structured audit events, health/readiness checks, and incident alerts.
7. Define privacy/retention rules and evaluate accessibility in the supported browsers.
8. Run end-to-end tests against actual integration sandboxes before enabling outbound effects.

A polished public repository does not establish production readiness. This preview has no service-level objective, production users, or verified operational impact.

