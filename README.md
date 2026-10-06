# Dreamboard

**The operations workspace for DreamProtocol.**

Dreamboard turns requests into owned, reviewable work. It brings intake, task progress, human approvals, activity, and integration receipts into one workspace.

[![Validate](https://github.com/pooledlp/dreamboard/actions/workflows/ci.yml/badge.svg)](https://github.com/pooledlp/dreamboard/actions/workflows/ci.yml)

**Status:** working pre-production product preview. Public source for review; no live customers, production tenure, or business-impact claims. The server runs locally and does not execute external work.

## What works

- **Overview:** saved-task metrics, attention queue, workflow distribution, and recent activity.
- **Work board:** Inbox → In progress → In review → Done, with project/owner filters and search.
- **Task management:** create and edit tasks, assign owners, set priorities and due dates, add comments.
- **Human approvals:** approval-required tasks cannot bypass review; reviewers can return work with feedback.
- **Conflict handling:** version checks reject stale edits instead of silently overwriting changes.
- **Intake API:** source/external-ID deduplication, payload-conflict detection, and replay receipts.
- **Persistence:** serialized, atomic JSON replacement with flushed writes; changes are published only after saving.
- **Review tools:** explicit fictional sample data and a downloadable workspace export.

Dreamboard complements [DreamProtocol Receptionist](https://github.com/pooledlp/dreamprotocol-receptionist). This standalone repository has its own data and workflow. The receptionist is not automatically connected.

## Run

Node.js 22 or later. No third-party packages or install step required.

```sh
git clone https://github.com/pooledlp/dreamboard.git
cd dreamboard
npm start
```

Open **http://127.0.0.1:4320**.

Optional: copy `.env.example` to `.env` to change the local port.

## Review in five minutes

1. Open **Integrations → Load sample workspace**. All five requests are explicitly fictional; loading again creates no duplicates.
2. Open **Work board**, search or filter by owner, and open a task.
3. Choose **Start work**, edit its context, and add a comment.
4. Choose **Send for review**; find it in **Approvals**.
5. Request changes with feedback, or choose **Approve & complete**.
6. Reopen a completed task; its previous approval is cleared.
7. Inspect **Activity** and **Intake receipts**.
8. Restart the server; verify the saved workspace remains.

The app starts empty. Dashboard totals come from actual saved tasks, not fabricated performance data.

## Engineering evidence

- [Engineering case study](docs/engineering-case-study.md): problem, architecture, contribution boundaries, technologies, users, failure handling, human review, impact, and code links.
- [Architecture and decisions](docs/architecture.md)
- [API contract](docs/api.md)
- [Operations and production-readiness plan](docs/operations.md)
- [Review checklist](docs/review-checklist.md)
- [Example intake request](examples/intake.json)

## Validate

```sh
npm run check
npm test
```

The behavior suite covers review gates, stale updates, replay conflicts, validation, persisted restarts, failed writes, corrupt storage, HTTP boundaries, and repeat-safe sample data. CI runs on Linux and Windows with Node.js 22.

## Repository structure

```text
public/            Browser interface: overview, work board, approvals, activity
src/domain.mjs     Task rules, transitions, validation, idempotent intake
src/store.mjs      Serialized transactions and local persistence
server.mjs         Same-origin HTTP API and explicit public-asset serving
test/              Behavior and HTTP integration tests
examples/          Fictional API request and local intake client
docs/              Architecture, API, operations, and case study
.github/           Validation workflow and pull-request template
```

## Scope and deployment

This is a single-process, single-operator local preview. The server binds to 127.0.0.1 and rejects unknown hosts and cross-origin requests. **It has no production authentication or tenant isolation.** Do not expose it through a tunnel or use real customer data.

Approvals enforce a workflow gate, not separate reviewer identity. The same local operator can create, perform, and approve a task. Activity is append-only through the API, but is not tamper-proof.

No AI model, autonomous worker, calendar, email, or voice service is invoked. Dreamboard is the operational control surface for that future work. Integrations need an explicitly configured adapter before connecting to a live system.

See [SECURITY.md](SECURITY.md). No open-source reuse license has been selected; public visibility is for review.

