# C-3 — Empty-State Audit

**Date:** 2026-06-07
**Owner:** myoffice-integration-qa
**Constraint:** Every status surface must render an explicit empty state. Zero fabrication.

---

## Surfaces audited

| Surface | File | Empty state | Verdict |
|---|---|---|---|
| Office canvas (no projects) | `office/scenes/OfficeScene.ts:215` | "No projects yet. Open the grid view to add one." | ✅ PASS |
| Dashboard grid (no projects) | `pages/Dashboard.tsx:192` | "No projects yet" + add-project CTA | ✅ PASS |
| Workstation tasks (no tasks) | `pages/Workstation.tsx:226` | "No tasks yet. Dispatch one above." | ✅ PASS |
| Workstation chat (no messages) | `pages/Workstation.tsx:246` | "Ask the project CEO anything." | ✅ PASS |
| Workstation activity (no commits) | `pages/Workstation.tsx:318` | "No commits synced yet. Click Sync to pull from GitHub." | ✅ PASS |
| Workstation activity (no repo) | `pages/Workstation.tsx:311` | "No GitHub repo configured" | ✅ PASS |
| Briefing banner (no briefing) | `pages/Dashboard.tsx` | Component returns null (no fabricated welcome) | ✅ PASS |
| Jarvis FAB (no conversation) | `components/JarvisPanel.tsx` | "Good <morning/afternoon/evening>, Riley." with usage hint | ✅ PASS |
| Office tab bar (no projects) | `components/OfficeTabBar.tsx:42` | "No projects yet" inline | ✅ PASS |
| Workstation activity counter | `pages/Workstation.tsx:299` | "No activity yet" when count = 0 | ✅ PASS |

## Anti-fabrication checks

- **CEO chat** does NOT auto-send a welcome message on empty conversations (C-3 rule). Only renders the hint text.
- **Jarvis greeting** is local time-of-day text, NOT a fabricated LLM response.
- **Activity feed** never inserts fake "system" entries on empty repos. It shows the empty state literally.
- **Briefing component** returns null when no briefing exists rather than fabricating a default.

## Verdict
**10/10 PASS** — Every status surface renders an explicit empty state. No surface fabricates content to fill space.

## Follow-ups
- Workstation chat input remains disabled while streaming — already enforced (`disabled={streaming}` at `Workstation.tsx:281`).
- Office canvas reaction effects fire only on real socket events (no synthetic events).
