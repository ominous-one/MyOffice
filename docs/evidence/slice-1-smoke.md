# S1-T18 Evidence — Slice 1 End-to-End Smoke Test

**Status: PENDING — deploy in progress (commit c7f0cfd)**
**Target URL:** https://cowork.lotview.ai

## Test procedure

Happy path: login → add project → daemon online → dispatch "list files" → see streamed output → task completes → refresh browser → state persists.

---

## Step 1 — Login

**URL:** `https://cowork.lotview.ai/login`
**Action:** Enter password, click Login

| Check | Target | Actual |
|---|---|---|
| HTTP response to POST /api/auth/login | 200 `{ok:true}` | [fill in] |
| `cowork_session` cookie set (HttpOnly) | YES | [fill in] |
| Redirect to dashboard | YES | [fill in] |

**Timestamp:** [fill in]

---

## Step 2 — Add project

**Action:** Click "Add project", enter a project name, submit

| Check | Target | Actual |
|---|---|---|
| POST /api/projects returns 201 | YES | [fill in] |
| Project card appears in project list | YES | [fill in] |

**Timestamp:** [fill in]

---

## Step 3 — Daemon online indicator

| Check | Target | Actual |
|---|---|---|
| Dashboard shows daemon status indicator | "Online" / green | [fill in] |
| Last heartbeat timestamp visible | YES | [fill in] |

**Note:** Daemon must be running on Windows machine with Redis connected. If daemon is offline, this step is BLOCKED on operator action.

**Timestamp:** [fill in]

---

## Step 4 — Dispatch "list files in this directory"

**Action:** Open project workstation, type "list files in this directory" in task input, submit

| Check | Target | Actual |
|---|---|---|
| POST /api/tasks enqueues task | YES | [fill in] |
| Task appears in task list with status `queued` | YES | [fill in] |
| Status transitions to `in_progress` within 5s | YES | [fill in] |

**Timestamp:** [fill in]

---

## Step 5 — Streamed output visible in browser

| Check | Target | Actual |
|---|---|---|
| Task output chunks appear in browser (Socket.IO `task.output`) | YES | [fill in] |
| First chunk arrives within 2s of `in_progress` | YES | [fill in] |
| Output is non-empty and makes sense (file list) | YES | [fill in] |

**Sample output excerpt:**
```
[paste 3+ consecutive output chunks here]
```

**Timestamp:** [fill in]

---

## Step 6 — Task completes

| Check | Target | Actual |
|---|---|---|
| Task status transitions to `completed` | YES | [fill in] |
| Final task row has non-empty `transcript` | YES | [fill in] |
| No error state or stuck `in_progress` | YES | [fill in] |

**Timestamp:** [fill in]

---

## Step 7 — Refresh and state persists

**Action:** Hard refresh (`Ctrl+F5`) the browser

| Check | Target | Actual |
|---|---|---|
| Session cookie survives refresh (user stays logged in) | YES | [fill in] |
| Project still visible in project list | YES | [fill in] |
| Completed task still visible in task list with correct status | YES | [fill in] |

**Timestamp:** [fill in]

---

## Overall result

| | |
|---|---|
| **S1-T18 status** | PASS / FAIL |
| **Smoke test date** | [fill in] |
| **Git commit** | c7f0cfd |
| **Notes** | |

---

## Slice 1 Gate

- [ ] All 7 smoke test steps PASS
- [ ] Windows-dependent evidence collected: UU-2, C-4, C-2
- [ ] TTI measured and documented in `uu-3-tti.md`
- [ ] Security review: PASS (see `sec-auth-review.md`)
- [ ] Canvas sprites: PASS (see `uu-7-canvas.md`)

**COO sign-off:** [pending]
> "Slice 1 green — proof-of-architecture confirmed"
