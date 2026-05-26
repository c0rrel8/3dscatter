param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$ScriptPath,

    [Parameter(ValueFromRemainingArguments = $true, Position = 1)]
    [string[]]$ScriptArgs
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

$resolvedScriptPath = Join-Path $PSScriptRoot $ScriptPath
if (-not (Test-Path $resolvedScriptPath)) {
    throw "Node script not found: $resolvedScriptPath"
}

$nodeVersion = (& $NodeExe -v)
if (-not $nodeVersion.StartsWith("v20.")) {
    throw "Node 20.x is required. Current version: $nodeVersion"
}

& $NodeExe $resolvedScriptPath @ScriptArgs
exit $LASTEXITCODE
