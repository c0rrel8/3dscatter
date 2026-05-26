# Environment Setup

## Standard baseline

- Install official Node.js `20.20.1` for Windows x64 from [nodejs.org](https://nodejs.org/download/release/latest-v20.x/node-v20.20.1-x64.msi).
- Prefer an all-users installation when run from an elevated normal Windows session.
- Install PowerShell 7 so `pwsh` is available on `PATH`. The current `powerbi-visuals-tools` certificate flow uses `pwsh`.
- Install `powerbi-visuals-tools` through the project with `npm install`; the repo pins version `7.0.3`.
- Run `npm install` again after Node 20 is in place so lifecycle scripts execute under the supported runtime.
- Run `npm run bootstrap` from [visual](/C:/Users/corey/OneDrive/Documentos/Local%20Codex/3dscatter/visual) after Node 20 is installed.

## Current blocker in this Codex session

- The current shell is not elevated, so an all-users MSI install cannot be completed here.
- Direct HTTPS download of the official Node MSI from this sandboxed shell failed due Windows TLS/network credential issues, so the installer could not be fetched directly in-session.
- Because of that, the repo is prepared for the correct standard toolchain, but the host machine still needs the normal Node 20 installation step completed outside this constrained shell.
