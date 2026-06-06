# UU-3 Verification — TTI ≤ 3s on Render Standard

**Status: PENDING OPERATOR ACTION**
**Target URL:** https://cowork.lotview.ai

## Measurement procedure

1. Open Chrome on the test machine.
2. Open DevTools → Performance tab.
3. Check "Disable cache" (to simulate first visit).
4. Click "Record" → navigate to `https://cowork.lotview.ai/login`.
5. Stop recording when the login form is fully interactive.
6. Note the **Time to Interactive (TTI)** value from the Performance summary.
7. Alternatively use Lighthouse: DevTools → Lighthouse → "Performance" → Generate report.

**Lighthouse is preferred** — it produces a shareable score and explicit TTI figure.

---

## Results

**Measurement method:** [ ] Chrome Performance panel  [ ] Lighthouse

**Network condition:** [ ] No throttling  [ ] Fast 3G  [ ] Slow 3G

| Metric | Target | Actual |
|---|---|---|
| Time to Interactive (TTI) | ≤ 3000ms | [fill in] ms |
| First Contentful Paint (FCP) | ≤ 1800ms | [fill in] ms |
| Largest Contentful Paint (LCP) | ≤ 2500ms | [fill in] ms |
| Total Blocking Time (TBT) | ≤ 200ms | [fill in] ms |

**Lighthouse Performance score:** [fill in] / 100

---

## Evidence

**Screenshot or Lighthouse report excerpt:**
```
[paste Lighthouse TTI number or Performance panel screenshot description]
```

**Measured on:** [date + time]
**Git commit:** [fill in — should be c7f0cfd or later]
**Render plan:** Standard ($25/mo)

---

## Decision

- [ ] **PASS** — TTI ≤ 3000ms on no-throttle. NFR-1 confirmed.
- [ ] **CONDITIONAL PASS** — TTI ≤ 3000ms on Fast 3G. Acceptable for target users.
- [ ] **FAIL** — TTI > 3000ms. Escalate: profile JS bundle, consider SSR or plan upgrade.

**Note from architecture doc:** "TTI on Render Standard (UU-3) may force either a Pro plan upgrade ($25 over budget) or aggressive SSR caching work not scoped here."
