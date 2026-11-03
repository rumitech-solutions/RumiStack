# Shared helpers for RumiStack scripts. Dot-source this file: . (Join-Path $PSScriptRoot 'lib\Common.ps1')

Set-StrictMode -Version Latest

function Get-RumiRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
}

function Read-JsonFile {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { throw "File not found: $Path" }
    return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Test-Command {
    param([Parameter(Mandatory)][string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Test-SafeId {
    param([string]$Value)
    return ($Value -match '^[a-z0-9][a-z0-9-]{0,62}$')
}

function Get-NodeVersion {
    if (-not (Test-Command 'node')) { return $null }
    $raw = (& node --version) -replace '^v', ''
    $parts = $raw.Split('.')
    return [version]::new([int]$parts[0], [int]$parts[1], [int]$parts[2])
}

function Test-NodeAtLeast {
    param([Parameter(Mandatory)][version]$Minimum)
    $current = Get-NodeVersion
    if ($null -eq $current) { return $false }
    return ($current -ge $Minimum)
}

# Only these shapes are ever passed to winget / npm. The registry is trusted, but we still refuse odd input.
function Test-WingetId  { param([string]$Value) return ($Value -match '^[A-Za-z0-9][A-Za-z0-9.-]{2,100}$') }
function Test-NpmPackage { param([string]$Value) return ($Value -match '^(@[a-z0-9][a-z0-9-._~]*/)?[a-z0-9][a-z0-9-._~]*$') }
function Test-GitHubHttpsUrl { param([string]$Value) return ($Value -match '^https://github\.com/[\w.-]+/[\w.-]+$') }

function Get-Prop {
    # Strict-mode-safe property read: optional JSON fields (such as "clone") may be absent.
    param($Object, [string]$Name, $Default = $null)
    $p = $Object.PSObject.Properties[$Name]
    if ($p) { return $p.Value }
    return $Default
}

function Get-JsonArray {
    # ConvertFrom-Json turns an empty array into $null in some hosts; normalise.
    param($Value)
    if ($null -eq $Value) { return @() }
    return @($Value)
}

function Write-Step { param([string]$Message) Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Message) Write-Host "  [ok]   $Message" -ForegroundColor Green }
function Write-Skip { param([string]$Message) Write-Host "  [skip] $Message" -ForegroundColor DarkGray }
function Write-Manual { param([string]$Message) Write-Host "  [manual] $Message" -ForegroundColor Yellow }
