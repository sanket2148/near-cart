# NearCart — Task Tracking

This folder tracks **all implementation tasks** for the NearCart project.

## For AI Agents

**Read this first before starting any work.**

1. Check `active-sprint.md` for the current sprint and what's in progress.
2. Check individual task files in `done/` to see what's already been completed.
3. When you start a task, mark it `[/]` (in progress) in `active-sprint.md`.
4. When you finish a task, mark it `[x]` and move details to a file in `done/`.
5. If you create new files or modify existing ones, **log them** in the task's completion entry.

## Folder Structure

```
tasks/
├── README.md              ← You are here
├── active-sprint.md       ← Current sprint with task statuses
├── backlog.md             ← Future tasks not yet scheduled
├── decisions.md           ← Key decisions made during implementation
└── done/                  ← Completed task logs (one per task or sprint)
    └── YYYY-MM-DD-description.md
```

## Task Status Legend

```
[ ] — Not started
[/] — In progress
[x] — Completed
[!] — Blocked (note the reason)
[~] — Skipped / deferred (note the reason)
```

## Rules

- **Never delete tasks** — move them to `done/` or mark as `[~]` skipped.
- **Always log files changed** — future agents need to know what was touched.
- **Always log decisions** — if you made a non-obvious choice, add it to `decisions.md`.
- **One truth** — if something conflicts between this tracker and the `plan/` docs, update both.
