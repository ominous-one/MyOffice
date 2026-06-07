# UU-2 Verification — Claude CLI Executor Decision

**Status: PASS**
**Verdict: `executor: "wsl"`**
**Tested:** 2026-06-07

---

## Summary

Windows `claude.exe` is present on the Windows machine but is NOT authenticated (no Anthropic
account linked). WSL2 `claude` IS authenticated and is the only functional executor.

**Decision: daemon runs from WSL2 using `/usr/bin/claude`.**

---

## WSL claude binary (authenticated — PRIMARY EXECUTOR)

```
$ which claude
/usr/bin/claude

$ claude --version
2.1.150 (Claude Code)

$ ls -la /usr/bin/claude
lrwxrwxrwx 1 root root 60 May 25 17:33 /usr/bin/claude -> ../lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe
```

WSL username: `ominous`
WSL distro: Ubuntu on WSL2 (kernel 6.6.114.1-microsoft-standard-WSL2)
Auth: Anthropic API key in environment (`ANTHROPIC_API_KEY`)

---

## Windows claude.exe (NOT authenticated — rejected)

```
C:\> where.exe claude
C:\Users\omino\.local\bin\claude.exe

C:\> claude --version
2.1.84 (Claude Code)

Outcome: NOT authenticated — no Anthropic account linked on Windows side.
Real API calls fail with auth error.
```

Windows username: `omino`
Windows claude.exe version: 2.1.84
Status: binary present, not authenticated → cannot execute real tasks

---

## Executor decision

| Option | Status | Reason |
|---|---|---|
| `executor: "native"` | ❌ REJECTED | `claude.exe` on Windows is not authenticated |
| `executor: "wsl"` | ✅ SELECTED | `/usr/bin/claude` in WSL is authenticated via `ANTHROPIC_API_KEY` |

**`executor: "wsl"`**

---

## CWD translation rule

Since the daemon runs inside WSL2, project paths must be WSL-native paths:

| Windows path | WSL path | Correct? |
|---|---|---|
| `C:\Users\ominous\projects\claude-cowork` | `/home/ominous/projects/claude-cowork` | ✅ Use WSL path |
| `C:\Users\ominous\projects\claude-cowork` | `C:\Users\ominous\projects\claude-cowork` | ❌ ENOENT in WSL |

**Rule:** Projects registered in HQ must use WSL paths (e.g., `/home/ominous/projects/...`),
not Windows paths (e.g., `C:\Users\...`). The Windows-path project that was registered earlier
(`MyOffice HQ`) was superseded by the WSL-path project (`MyOffice HQ (WSL)`).

---

## Verification: successful end-to-end execution from WSL daemon

Task `0d8e7d9c-1e45-4e3d-9062-6b9654095c30` — status `completed`, exit code 0, transcript present.
See `c-4-real-claude.md` for full evidence.

**UU-2: PASS — executor: wsl**
