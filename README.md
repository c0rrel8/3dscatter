# Native 3D Scatter for Power BI

This repository contains a native Power BI custom visual project in [visual](/C:/Users/corey/OneDrive/Documentos/Local%20Codex/3dscatter/visual).

## Scope

V1 field wells:

- `X`
- `Y`
- `Z`
- `Size`
- `Color`
- `Category`
- `Tooltip`

Planned for V2:

- `Shape`

## Current status

The visual now renders a native interactive 3D scatter scene with host-aware selection, tooltip, palette, high-contrast, localization, landing-page, and highlight behavior. The host toolchain is also automated end to end for bootstrap, verification, and packaging.

The repository is standardized around:

- official Node.js `20.20.2`
- project-managed `powerbi-visuals-tools` `7.0.3`
- PowerShell 7 (`pwsh`) for certificate generation used by `pbiviz install-cert`
- explicit wrapper scripts that force the installed Node 20 runtime for `pbiviz`, `doctor`, and packaging even if the launching shell has a stale `PATH`
- automated `lint`, `typecheck`, `test`, `verify`, `doctor`, `bootstrap`, and `host:verify` scripts
- project and process learning logs in markdown

## Host workflow

The host baseline is now working:

- `npm run bootstrap` validates Node 20 and PowerShell 7, installs dependencies, skips repeat certificate import when `pbiviz-certs` already exist, and runs repo verification
- `npm run host:verify` runs the full host loop and produces a `.pbiviz` package in [visual/dist](/C:/Users/corey/OneDrive/Documentos/Local%20Codex/3dscatter/visual/dist)
- `npm run package` and `npm run start` now route through wrapper scripts so they keep using the installed Node 20 runtime even when another shell still has an older Node earlier on `PATH`

## Local commands

From [visual](/C:/Users/corey/OneDrive/Documentos/Local%20Codex/3dscatter/visual):

```powershell
cd 'C:\Users\corey\OneDrive\Documentos\Local Codex\3dscatter\visual'
npm install
npm run bootstrap
npm run start
```

For full host-side validation and packaging, use one command:

```powershell
cd 'C:\Users\corey\OneDrive\Documentos\Local Codex\3dscatter\visual'
npm run host:verify
```

If `npm run bootstrap` fails with `'pwsh' is not recognized`, install PowerShell 7 and reopen the terminal before retrying. Certificate import is intended to be a one-time setup step; once the `pbiviz-certs` files exist, bootstrap skips reopening the wizard.

## Official references

- [Develop Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/develop-power-bi-visuals)
- [Set up the Power BI visual environment](https://learn.microsoft.com/en-us/power-bi/developer/visuals/environment-setup)
- [Capabilities and properties](https://learn.microsoft.com/en-us/power-bi/developer/visuals/capabilities)
- [Fetch more data](https://learn.microsoft.com/en-us/power-bi/developer/visuals/fetch-more-data)
