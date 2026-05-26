$ErrorActionPreference = "Stop"

function Resolve-Tooling {
    $preferredNodeDir = "C:\Program Files\nodejs"
    $preferredPwshDir = "C:\Program Files\PowerShell\7"
    $script:WindowsPowerShellExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
    $existingPathParts = $env:PATH -split ";" | Where-Object { $_ -and $_ -ne $preferredNodeDir -and $_ -ne $preferredPwshDir }
    $env:PATH = ($preferredNodeDir, $preferredPwshDir, $existingPathParts) -join ";"

    $script:NodeExe = Join-Path $preferredNodeDir "node.exe"
    $script:NpmCmd = Join-Path $preferredNodeDir "npm.cmd"
    $script:PwshExe = Join-Path $preferredPwshDir "pwsh.exe"

    if (-not (Test-Path $script:NodeExe)) {
        $script:NodeExe = "node"
    }
    if (-not (Test-Path $script:NpmCmd)) {
        $script:NpmCmd = "npm.cmd"
    }
    if (-not (Test-Path $script:PwshExe)) {
        $script:PwshExe = "pwsh"
    }
}

Resolve-Tooling

Write-Host "Running host verification for Native 3D Scatter..."

Write-Host "Checking Node runtime..."
$nodeVersion = (& $NodeExe -v)
Write-Host "Node version: $nodeVersion"
if (-not $nodeVersion.StartsWith("v20.")) {
    throw "Node 20.x is required for host verification. Current version: $nodeVersion"
}

Write-Host "Checking PowerShell 7..."
$pwshVersion = (& $PwshExe --version)
Write-Host "PowerShell version: $pwshVersion"

Write-Host "Installing npm dependencies..."
& $NpmCmd install
if ($LASTEXITCODE -ne 0) {
    throw "npm install failed."
}

Write-Host "Running bootstrap..."
& $WindowsPowerShellExe -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "bootstrap.ps1")
if ($LASTEXITCODE -ne 0) {
    throw "npm run bootstrap failed."
}

Write-Host "Running package..."
& $NpmCmd run package
if ($LASTEXITCODE -ne 0) {
    throw "npm run package failed."
}

$distFolder = Join-Path $PSScriptRoot "..\dist"
if (Test-Path $distFolder) {
    Write-Host "Artifacts in dist:"
    Get-ChildItem $distFolder | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
}

Write-Host "Host verification completed successfully."
