# PROJECT_CLINE_RULES.md

Permanent Cline rules for Helix Heresy.

These are reusable guardrails. Keep task-specific instructions in the active workpack.

---

## 1. Project safety

- Do not commit.
- Do not push.
- Do not install dependencies unless explicitly instructed.
- Do not edit `.git`.
- Do not edit `node_modules`.
- Do not update `CHANGELOG.md` unless explicitly instructed.
- Do not implement unrelated systems.
- Do not do broad refactors during a phase, cleanup pass, or executor task.
- Do not start the next phase/pass unless the user explicitly asks.

Helix Heresy is a static browser prototype.

Useful syntax check:

```powershell
node --check app.js
```

There is no build step unless the user says otherwise.

---

## 2. Workpack hierarchy

Follow instructions in this order:

1. The user's latest message
2. The active workpack
3. This rules file
4. Older handoff log entries
5. Older chat context

If the active workpack is an **executor workpack**, treat Cline as an executor, not a designer.

Executor workpack means the task asks for an exact edit such as:

```txt
Delete this function.
Replace this function body.
Change this one line.
Add this exact helper.
```

For executor workpacks:

- Do not open/read source files first unless the workpack explicitly says to.
- Do not scan broad sections of `app.js`.
- Use the exact search command from the workpack to locate the target.
- Make only the requested edit.
- Run the requested checks.
- Update the handoff log.
- Stop.

---

## 3. Windows PowerShell terminal rules

The terminal is **Windows PowerShell**, not Linux/macOS shell.

Preferred commands:

```powershell
git status --short
git diff --name-only
node --check app.js
rg -n "PATTERN" app.js
rg -n "PATTERN" app.js | Select-Object -First 20
grep -n "PATTERN" app.js
grep -n "PATTERN" app.js | Select-Object -First 20
```

Do not use Unix-only commands in PowerShell:

```txt
head
tail
sed
awk
xargs
find ... -exec
```

Use these instead:

```powershell
rg -n "PATTERN" app.js | Select-Object -First 20
rg -n "PATTERN" app.js | Select-Object -Last 20
```

If `rg` fails, use `grep`.

If both `rg` and `grep` fail, use:

```powershell
Select-String -Path .\app.js -Pattern "PATTERN" | Select-Object LineNumber, Line
```

Do not keep trying Linux commands after they fail.

---

## 4. Source-reading discipline

Default rule:

- Do not read all of `app.js`.
- Do not read thousands of lines.
- Do not read broad ranges just to understand the app.
- Do not reread large files just to be safe.

For design/cleanup workpacks:

1. Run a narrow search command.
2. Read only the small nearby section around the result.
3. Edit only the relevant area.
4. Run checks.
5. Update the handoff log.
6. Stop.

For executor workpacks:

1. Run the exact search/check command requested.
2. Edit only the exact target.
3. Do not inspect unrelated code.
4. Run checks.
5. Update the handoff log.
6. Stop.

If you think you need more context, read the smallest nearby section possible. If that is not enough, stop and explain what context is missing.

---

## 5. Diff discipline

Prefer:

```powershell
git diff --name-only
```

Do not run full `git diff` unless:

- the user asks for it,
- the active workpack explicitly requires it,
- or a targeted review is genuinely necessary.

If a targeted review is needed, prefer:

```powershell
git diff -- app.js
```

Avoid dumping huge diffs into context.

---

## 6. Completion proof

A task is not complete just because `CODEX_HANDOFF_LOG.md` changed.

For coding tasks, completion requires:

1. the expected source file changed,
2. `git diff --name-only` shows the expected source file,
3. the expected function/constant/UI area changed,
4. `node --check app.js` was run when `app.js` changed,
5. `node --check app.js` passed,
6. `CODEX_HANDOFF_LOG.md` honestly describes the actual source-code change.

If only `CODEX_HANDOFF_LOG.md` changed, report:

```txt
Task not complete. Only the handoff log changed.
```

Do not claim success.

---

## 7. Handoff log rules

After a meaningful source-code change, append to `CODEX_HANDOFF_LOG.md`.

Do not delete or rewrite old handoff entries.

If an earlier entry was wrong, add a correction entry.

Every handoff entry should include:

- phase/pass/task summary
- files touched
- functions/constants changed
- what changed
- why it changed
- uncertainty or possible problems
- commands/checks actually run
- check results
- what the user or Codex should review later

Do not claim a command passed unless it actually ran and passed.

---

## 8. Loop prevention

If you notice that you are:

- rereading the same file sections,
- restarting from the beginning,
- repeatedly checking the same thing,
- scanning through `app.js` without editing,
- using failing Unix commands in PowerShell,
- or trying to understand the whole file during an executor task,

then stop.

Report:

```txt
I appear to be looping. I will stop rather than continue scanning.
```

Then update `CODEX_HANDOFF_LOG.md` with:

- what task was attempted,
- what files/functions were inspected,
- what commands were run,
- what failed or remained unfinished,
- what the next step should be.

Do not keep trying.

---

## 9. Helix Heresy design constraints

- Slimes are natural organisms, not artificial inventions.
- All slimes are magical by nature.
- Elemental affinity is a specialized expression, not the source of slime magic.
- Weird trait combinations are allowed. Make them awkward rather than impossible.
- Preserve the discovery loop.
- Do not reveal hidden gene mappings or exact hidden trait tables in player-facing UI.
- Environmental sustenance should stay slow unless room/container systems make it meaningful.
- Natural splitting obeys mass conservation.
- Keep runtime dependency-free.

---

## 10. Stop behavior

At the end of a phase, cleanup pass, or executor task:

1. report what changed,
2. report what was not changed,
3. report actual check results,
4. update `CODEX_HANDOFF_LOG.md`,
5. stop.

Do not start another phase, cleanup pass, executor task, or new feature unless the user explicitly asks.
