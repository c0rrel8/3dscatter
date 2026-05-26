$ErrorActionPreference = "Stop"

function Resolve-Tooling {
    $preferredNodeDir = "C:\Program Files\nodejs"
    $preferredPwshDir = "C:\Program Files\PowerShell\7"
    $existingPathParts = $env:PATH -split ";" | Where-Object { $_ -and $_ -ne $preferredNodeDir -and $_ -ne $preferredPwshDir }
    $env:PATH = ($preferredNodeDir, $preferredPwshDir, $existingPathParts) -join ";"

    $script:NodeExe = Join-Path $preferredNodeDir "node.exe"
    $script:NpmCmd = Join-Path $preferredNodeDir "npm.cmd"
    $script:NpxCmd = Join-Path $preferredNodeDir "npx.cmd"
    $script:PwshExe = Join-Path $preferredPwshDir "pwsh.exe"

    if (-not (Test-Path $script:NodeExe)) {
        $script:NodeExe = "node"
    }
    if (-not (Test-Path $script:NpmCmd)) {
        $script:NpmCmd = "npm.cmd"
    }
    if (-not (Test-Path $script:NpxCmd)) {
        $script:NpxCmd = "npx.cmd"
    }
    if (-not (Test-Path $script:PwshExe)) {
        $script:PwshExe = "pwsh"
    }
}

Resolve-Tooling

Write-Host "Checking Node major version..."
$nodeMajor = (& $NodeExe -p "process.versions.node.split('.')[0]")
if ($nodeMajor -ne "20") {
    throw "Node 20.x is required. Current version: $(& $NodeExe -v)"
}

Write-Host "Checking PowerShell 7 availability for pbiviz certificate tooling..."
try {
    & $PwshExe --version | Out-Null
} catch {
    throw "Power BI visual certificate tooling requires 'pwsh' (PowerShell 7). Install PowerShell 7 and reopen the terminal."
}

Write-Host "Installing npm dependencies..."
& $NpmCmd install

$certFolder = Join-Path $env:USERPROFILE "pbiviz-certs"
$pfxPath = Join-Path $certFolder "PowerBICustomVisualTest_public.pfx"
$passphrasePath = Join-Path $certFolder "PowerBICustomVisualTestPass.txt"

if ((Test-Path $pfxPath) -and (Test-Path $passphrasePath)) {
    Write-Host "Power BI localhost certificate already exists. Skipping certificate import prompt."
} else {
    Write-Host "Installing local Power BI localhost certificate..."
    & $NpxCmd pbiviz install-cert
    if ($LASTEXITCODE -ne 0) {
        throw "pbiviz install-cert failed."
    }
}

Write-Host "Running verification suite..."
& $NpmCmd run build:tests
& $NpmCmd run verify
