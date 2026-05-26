# Project Learnings

## 2026-04-02

- Standardize this project on Node `20.x` for Power BI custom visual development.
- Avoid portable or repo-bundled Node runtimes for normal development workflow; use an official Node installer instead.
- Treat `pbiviz` as a normal project-managed development dependency so scripts are reproducible across machines.
- Keep `Shape` out of V1. The approved V1 wells are `X`, `Y`, `Z`, `Size`, `Color`, `Category`, and `Tooltip`.
- Internal deployment is the first target. AppSource certification constraints matter later, but they should not prematurely narrow development choices.
- Always automate repeatable checks early: linting, typechecking, parsing tests, environment doctoring, and packaging commands.
- Record machine-level blockers explicitly instead of compensating with hidden shell workarounds.
- The official all-users Node install can coexist with the older portable Node runtime. Verify which one is active in each shell before trusting results.
- If an older portable Node path is ahead of `C:\Program Files\nodejs` in `PATH`, the official install can appear "broken" even when it succeeded. Resolve the path order before spending time debugging the installer itself.
- This Codex sandbox can validate the host installation path, but it may not be able to execute `C:\Program Files\nodejs\node.exe` against workspace files under `C:\Users\corey\...` because of sandbox filesystem restrictions. Use a normal user terminal for final host-level verification when needed.
- In PowerShell, `where node` is not a reliable path check because `where` is an alias. Use `where.exe node`.
- In PowerShell, call `npm.cmd` and `npx.cmd` directly when execution policy blocks `npm.ps1` and `npx.ps1`.
- `powerbi-visuals-tools` `7.0.3` uses `pwsh` during certificate generation. For a full local Power BI custom visual workflow, PowerShell 7 is a real prerequisite, not an optional convenience.
- The order of `files` in `tsconfig.json` matters to the Power BI packaging precompile step. Keep `src/visual.ts` as the entry file so `pbiviz` imports `Visual` from the correct module.
- Once host prerequisites are stable, wrap bootstrap and packaging into a single host verification script so repeated validation does not rely on manual copy/paste loops.
- Do not rerun `pbiviz install-cert` on every bootstrap. Treat certificate import as one-time host setup and skip it when the generated PFX and passphrase files already exist.
- On Windows, `npm run package` can still accidentally execute `pbiviz` through the wrong `node.exe` if the launching shell inherited an old portable runtime. Route direct `pbiviz`, `package`, `start`, and Node-based helper scripts through explicit PowerShell wrappers that force the installed Node 20 path.
- For Power BI custom visuals, the official Microsoft conditional-formatting model is standards-based for color properties, not arbitrary numeric/text/style properties. Treat `fx` support as a color-formatting capability unless Microsoft expands the platform.
- When implementing color conditional formatting in a custom visual, use the official wildcard-selector pattern: `createDataViewWildcardSelector(...)`, `altConstantValueSelector`, and `instanceKind = ConstantOrRule`.
- For this project, the `Color` data well was removed in `0.4.0.0`. Marker color is now format-driven: global default color when `Category` is unbound, palette/per-category formatting when `Category` is bound, and rule-based color formatting through the standard `fx` pathway.
- For production readiness, default the visual to a clean report surface. Internal prototype chrome like title, summary, badges, status copy, overlay labels, footer guidance, and diagnostics should be opt-in formatting toggles, not the default experience.
- The default visual background is transparent as of `0.5.0.0`. Decorative gradients and baked-in surface skins should not be the default if report authors may want the visual to blend into existing page themes.
