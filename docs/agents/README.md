# Agent Workflow

## Work Tracking

This repo does not currently define a committed issue-tracker workflow. When coordinating inside Conductor, use `.context/` for temporary notes, verification artifacts, and handoffs.

If formal work items are added later, document the tracker, labels, and state transitions here instead of scattering them across prompts.

## Skill Guidance

- Use `repo-context-bootstrap` when repairing or extending these context docs.
- Use `context-map` for unfamiliar module discovery before cross-cutting changes.
- Use `test-first-delivery` for behavior-changing provider, model, and query work.
- Use `proof-repair` for bugs, failing tests, and regressions.
- Use `frontend-design`, `polish`, or `audit` for UI quality passes.
- Use `handoff-brief` before pausing substantial unfinished work.

## Verification Notes

Use the smallest verification command that covers the changed behavior, then run `bun run build` for broader confidence before shipping meaningful app changes.

Current common commands:

- `bun --filter web test`
- `bun run build`
- `bun run check`

