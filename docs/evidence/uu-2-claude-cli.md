# UU-2 Verification — Claude CLI Mode on Windows

**Status: PENDING OPERATOR ACTION**

This evidence file requires the operator to run the following commands from
**plain PowerShell** on the primary Windows machine and paste the output below.

## Required commands

```powershell
where.exe claude
claude --version
claude -p "hello, respond with just the word pong"
```

## Expected decision

Based on the output, record one of:

- `executor: "native"` — claude.exe is in PATH on Windows and works directly
- `executor: "wsl"` — claude is only available inside WSL; daemon must prefix commands with `wsl claude`

If WSL: document the CWD translation rule (e.g., `C:\Projects\foo` → `/mnt/c/projects/foo`).

---

## Output (paste below)

```
[OPERATOR: paste `where.exe claude` output here]
```

```
[OPERATOR: paste `claude --version` output here]
```

```
[OPERATOR: paste `claude -p "hello"` output here]
```

## Decision recorded

`executor:` [OPERATOR: fill in "native" or "wsl"]

[OPERATOR: if wsl, document CWD translation rule here]
