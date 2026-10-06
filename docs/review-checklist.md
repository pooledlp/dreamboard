# Review checklist

Use fictional data only.

## Product flow

- [ ] Empty workspace presents a useful starting point.
- [ ] Load sample workspace creates five clearly labeled tasks; repeating creates none.
- [ ] Create a task with owner, project, priority, due date, and approval requirement.
- [ ] Search and owner/project filters return the expected tasks.
- [ ] Edit details, add a comment, and inspect activity.
- [ ] Start work and submit for review.
- [ ] Request changes requires feedback and returns the task to In progress.
- [ ] Approve the task; it appears in Done.
- [ ] Reopen the task; previous approval is cleared.
- [ ] Completed tasks cannot be edited without reopening.
- [ ] Counts update from saved data; overdue excludes completed tasks.
- [ ] Export contains saved tasks, events, and receipts.

## Failure and consistency

- [ ] Concurrent stale edits return 409.
- [ ] Identical intake replay creates no duplicate task.
- [ ] Conflicting intake payload with the same ID is rejected.
- [ ] Restart restores tasks, versions, receipts, and activity.
- [ ] Failed persistence does not publish a success or mutate committed state.
- [ ] Foreign-origin requests and non-public file requests are rejected.

## Presentation

- [ ] Keyboard navigation and visible focus work.
- [ ] Task dialog fits a narrow screen and can be closed with Escape.
- [ ] Long titles and descriptions wrap without overflowing.
- [ ] Errors preserve unsaved form content.
- [ ] Deployment status and integration boundaries are accurate.

Automated coverage is in `test/workspace.test.mjs`. Browser checks are separate from server tests and must not be inferred from a passing test suite.

