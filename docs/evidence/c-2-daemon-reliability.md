# C-2 Evidence — Daemon Crash → NSSM Restart, No Silent Task Drop

**Status: PENDING OPERATOR ACTION**

## Test procedure

1. Dispatch a task from HQ that will take at least 10 seconds to run.
2. While the task is `in_progress`, run in PowerShell:
   ```powershell
   Get-Process | Where-Object Name -like "*daemon*"
   # Note the PID
   Stop-Process -Id <PID> -Force
   ```
3. Watch HQ task status update.
4. Verify NSSM auto-restarts the daemon within 10 seconds.

## Expected outcomes

| Metric | Target | Actual |
|---|---|---|
| NSSM restart time | ≤ 10s | [OPERATOR: fill in] |
| In-flight task status after restart | `failed` with `reason='daemon_restart'` | [OPERATOR: fill in] |
| Task ever stuck in `in_progress` | NO | [OPERATOR: confirm] |
| Server-side reaper cron cleans up within 60s | YES | [OPERATOR: confirm] |

## Evidence

**PowerShell: kill command + timestamp:**
```
[OPERATOR: paste]
```

**HQ task status transition** (from Socket.IO events or DB query):
```
[OPERATOR: paste — show transition from in_progress → failed with reason]
```

**NSSM restart timestamp** (from daemon logs or Windows Event Log):
```
[OPERATOR: paste]
```

**BullMQ stalled-job recovery confirmation:**
```
[OPERATOR: confirm — daemon logs should show "stalled job recovered" or similar on restart]
```

## UU-4 checklist

- [ ] NSSM restarts daemon within 10 seconds of kill
- [ ] In-flight task lands in `failed` state, never stuck `in_progress`
- [ ] Reaper cron confirmed running (logs show 60s interval check)
- [ ] Redis AOF confirmed (queued tasks survive Redis restart)
