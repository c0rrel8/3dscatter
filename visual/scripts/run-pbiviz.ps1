param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$PbivizArgs
)

$ErrorActionPreference = "Stop"

function Resolve-Tooling {
    $preferredNodeDir = "C:\Program Files\nodejs"
    $preferredPwshDir = "C:\Program Files\PowerShell\7"
    $existingPathParts = $env:PATH -split ";" | Where-Object { $_ -and $_ -ne $preferredNodeDir -and $_ -ne $preferredPwshDir }
    $env:PATH = ($preferredNodeDir, $preferredPwshDir, $existingPathParts) -join ";"

    $script:NodeExe = Join-Path $preferredNodeDir "node.exe"
    if (-not (Test-Path $script:NodeExe)) {
        $script:NodeExe = "node"
    }
}

Resolve-Tooling

$nodeVersion = (& $NodeExe -v)
if (-not $nodeVersion.StartsWith("v20.")) {
    throw "Node 20.x is required. Current version: $nodeVersion"
}

$pbivizEntry = Join-Path $PSScriptRoot "..\node_modules\powerbi-visuals-tools\bin\pbiviz.js"
if (-not (Test-Path $pbivizEntry)) {
    throw "pbiviz entrypoint not found: $pbivizEntry"
}

& $NodeExe $pbivizEntry @PbivizArgs
exit $LASTEXITCODE
