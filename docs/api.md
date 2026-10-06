# Local API contract

Base URL: `http://127.0.0.1:4320`. All mutations require `Content-Type: application/json`.

This API is for a local review workspace. It has no production authentication; never publish it directly.

## Read workspace

`GET /api/workspace`

Returns tasks, events, receipts, computed metrics, and supported status/owner/project values.

## Create a task

`POST /api/tasks`

```json
{
  "submissionId": "review-submission-001",
  "title": "Review an appointment request",
  "description": "Fictional visitor requested Tuesday afternoon.",
  "project": "Customer experience",
  "owner": "Scheduling",
  "priority": "normal",
  "dueDate": "",
  "requiresReview": true
}
```

Returns 201 for a new task or 200 for an identical retry. The response contains `task`, `receipt`, and `duplicate`. A reused ID with changed content returns 409.

## Integration intake

`POST /api/intake`

Use the same task fields, replacing `submissionId` with `source` and `externalId`. See [examples/intake.json](../examples/intake.json).

```sh
node examples/send-intake.mjs
```

This sends only the fictional included fixture to the local server. Repeating it returns the original task. The script does not read from or connect to the receptionist repository.

### Receptionist mapping

| Receptionist field | Dreamboard field |
| --- | --- |
| Stable request ID | externalId |
| Constant adapter name | source, e.g. AI Receptionist |
| Reviewed request summary | title, maximum 140 characters |
| Reviewed request details | description, maximum 4,000 characters |
| Scheduling/sales/support assignment | owner from the supported queue values |
| Human review requirement | requiresReview: true |

Avoid embedding personal contact data in public examples. The existing receptionist does not automatically send this contract; implement and configure an adapter separately.

## Update a task

`PATCH /api/tasks/:id`

Send the complete editable fields (title, description, project, owner, priority, dueDate) and the latest integer `version`. Source and review requirement are immutable. Completed tasks return 409 until reopened.

## Workflow actions

`POST /api/tasks/:id/actions`

```json
{ "version": 2, "action": "submit-review" }
```

Actions: `start`, `submit-review`, `approve`, `request-changes`, `complete`, `reopen`, `comment`.

`request-changes` and `comment` require a non-empty `note` up to 2,000 characters. Invalid transitions and stale versions return 409.

## Samples

`POST /api/demo` with `{}` loads five fictional requests idempotently. It never deletes or overwrites existing tasks.

## Response errors

| Code | Meaning | Caller action |
| --- | --- | --- |
| 400 | Invalid JSON or fields | Correct the request |
| 403 | Host or origin rejected | Use the local workspace origin |
| 404 | Unknown route or task | Verify the URL / identifier |
| 409 | Stale version, conflicting replay, invalid transition, or capacity limit | Review the latest state before retrying |
| 413 | Body exceeds 16 KB | Reduce request size |
| 415 | Unsupported content type | Send JSON |
| 500 | Save or server failure | No success confirmed; inspect local logs and retry safely |

Supported owners: Unassigned, Operations, Scheduling, Sales, Support. Projects: Customer experience, Business operations, Delivery. Priorities: low, normal, high. Dates: valid YYYY-MM-DD or an empty string.

