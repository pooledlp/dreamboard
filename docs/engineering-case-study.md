# Dreamboard — Engineering case study

**Classification:** pre-production operations and orchestration example.  
**Code:** [github.com/pooledlp/dreamboard](https://github.com/pooledlp/dreamboard).  
**Related component:** [DreamProtocol Receptionist](https://github.com/pooledlp/dreamprotocol-receptionist).

## Problem

Unstructured customer requests need clear ownership, a next step, and a reviewable outcome. A conversation alone does not show whether someone accepted the work, checked it, or completed it. Replayed integrations and simultaneous edits can also duplicate or lose work.

## Architecture

Dreamboard separates the interface, HTTP boundary, domain rules, and persistence:

1. Manual or API intake validates a task and records a source/external-ID receipt.
2. Domain rules select the initial Inbox state and lock the review requirement.
3. The store serializes changes, writes and flushes a replacement file, then publishes the committed in-memory state.
4. Operators manage assignments, context, comments, and workflow transitions through the browser.
5. Review-required tasks reach Done only through an explicit approval action.
6. Every accepted mutation records an activity event.

A version number detects stale edits. Intake content is fingerprinted so a replay with different content is rejected instead of being treated as a harmless duplicate.

## Individual contribution

This implementation was developed with AI coding assistance. The candidate's personal contribution has not been independently established. Before submitting this as evidence of individual work, describe the specific requirements, architecture decisions, implementation, integration, testing, and operations they actually performed.

Repository ownership, generated code, and a polished demonstration do not by themselves establish prior personal production experience.

## Technologies

- Node.js 22+, JavaScript ES modules, native HTTP and filesystem APIs.
- Semantic HTML, responsive CSS, native browser APIs, no frontend build tool.
- SHA-256 intake fingerprints and UUID identifiers.
- Node test runner and GitHub Actions on Linux and Windows.
- Local JSON persistence; no production database or worker broker is claimed.

## Time in production

Not deployed to production. No production tenure is claimed.

## Users

Designed for business operators managing incoming requests and human reviewers checking work. Current use is local technical review with fictional fixtures. No active customer count is claimed.

## Failures and recovery

- Duplicate intake: same source and external ID return the original task.
- Conflicting replay: same identity with changed content returns HTTP 409.
- Concurrent edit: stale version returns HTTP 409; the operator refreshes before retrying.
- Failed save: no committed state is published; the API returns an error.
- Corrupt storage: startup fails instead of silently replacing existing records.
- Invalid payload: rejected before a mutation is saved.
- Restart: saved tasks, receipts, versions, and activity are reloaded.

The implementation is bounded to one process. Distributed consistency, multi-instance file locking, disaster recovery, and production observability remain future work.

## Human review

The workflow distinguishes doing work from approving it. Review-required tasks cannot directly complete. Reviewers can return work with a required feedback note. Reopening clears prior approval. Editing a completed task requires reopening first.

The preview does not authenticate distinct actors, enforce separation of duties, or execute outbound actions. Those are explicit production milestones.

## Demonstrated operational impact

The working artifact demonstrates a traceable path from intake to completion, protection against duplicate tasks and lost updates, and a review gate enforced server-side. Tests exercise these behaviors.

No customer time savings, uptime, cost reduction, throughput, conversion uplift, or revenue impact has been measured. Future field evaluation should compare baseline versus post-launch time to first ownership, review turnaround, duplicate rate, rework rate, and operator handling time.

## Code samples

| Capability | Implementation | Evidence |
| --- | --- | --- |
| Workflow and review gate | [src/domain.mjs](../src/domain.mjs) — `act` | Required-review and reopen tests |
| Version conflict protection | [src/domain.mjs](../src/domain.mjs) — `findTask` | Concurrent HTTP update test |
| Duplicate-safe intake | [src/domain.mjs](../src/domain.mjs) — `intake` | Replay and conflicting payload tests |
| Save-before-publish persistence | [src/store.mjs](../src/store.mjs) | Failure recovery and restart tests |
| Operator experience | [public/app.js](../public/app.js) | Browser review checklist |
| API boundary | [server.mjs](../server.mjs) | Origin, private-file, size, and JSON tests |

See the [full test suite](../test/workspace.test.mjs).

## What a production submission still needs

A candidate seeking to demonstrate previously shipped production work must add verified launch dates, actual users or anonymized teams, their individual responsibilities, incident/recovery examples, and measured results. Sanitized examples are acceptable. This preview is a code and design example, not a substitute for that history.

