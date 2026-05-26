# Process Refinement

## 2026-04-02

- Do not normalize portable runtime shims into the default workflow when the real project needs a standard installed toolchain.
- When a tool works only with shell-specific environment tweaks, treat that as diagnostic evidence, not as the final setup.
- Prefer repo-managed automation over remembered command sequences: add bootstrap, doctor, verify, and package entry points as early as possible.
- Separate project-specific lessons from general process corrections so future projects inherit the right defaults without inheriting irrelevant product scope.
- When a machine-level prerequisite cannot be completed from the current environment, document the exact blocker and the proper next action instead of replacing it with a workaround.
- Distinguish host-environment truth from sandbox-execution truth. A standard install can be correct even when the agent sandbox cannot exercise it directly; confirm with a normal terminal before changing course.
- On Windows PowerShell, use `where.exe node`, not `where node`. `where` is an alias for `Where-Object`, so it can silently produce misleading results during toolchain verification.
- On Windows PowerShell with restrictive execution policy, prefer `npm.cmd` and `npx.cmd` instead of `npm` and `npx` to avoid the recurring `npm.ps1 cannot be loaded because running scripts is disabled` failure.
- When a toolchain error names a missing executable like `pwsh`, treat it as a concrete prerequisite and document it immediately. Do not let bootstrap scripts continue after a failed prerequisite step.
- Once a workflow crosses the sandbox/host boundary, consolidate host validation into one script so the user is not repeatedly reduced to a copy/paste transport layer.
- When there is no meaningful decision or host-only blocker, continue implementing without pausing for user confirmation. Progress updates should not become accidental stop points.
- When Windows npm wrappers can still resolve an obsolete `node.exe` from `PATH`, do not keep debugging the shell state by hand. Move the repo commands behind explicit wrapper scripts that invoke the intended installed runtime directly.
- When a platform has an official extensibility pattern, prefer that over custom UI invention. For Power BI conditional formatting, align with the Microsoft wildcard-selector and `ConstantOrRule` model instead of building a bespoke rules editor.
