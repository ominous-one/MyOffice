# C-4 Evidence — Daemon Spawns Real Claude Child Process

**Status: PENDING OPERATOR ACTION**

This evidence must be captured on the Windows machine with the daemon running.

## What to capture

1. Dispatch the task "list files in this directory" against a real project.
2. Record the child process PID logged by the daemon.
3. Copy at least 3 consecutive `task.output` chunks (with timestamps) from the browser.
4. Paste the final `task` row JSON from the DB (or from the task details in HQ).

## Evidence template

**Daemon log excerpt** (shows PID):
```
[OPERATOR: paste daemon log showing spawned claude PID]
```

**Browser stream chunks** (timestamps from Socket.IO `task.output` events):
```
[OPERATOR: paste 3+ consecutive output chunks with timestamps]
```

**Final task row** (from `/api/tasks/:id` or DB query):
```json
[OPERATOR: paste final task row JSON — confirm status="completed" and transcript present]
```

## C-4 criterion

> Mock/stub execution is a build failure. A real `claude` child process (native or WSL per
> UU-2 verdict) must run in the correct `cwd`, and its PID must be logged.

Evidence above satisfies C-4 when:
- [ ] Child PID visible in daemon logs
- [ ] stdout chunks reach browser within 2s of emission (timestamps confirm)
- [ ] Final task row has `status: "completed"` and non-empty `transcript`
