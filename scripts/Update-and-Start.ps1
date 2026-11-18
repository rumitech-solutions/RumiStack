<#
.SYNOPSIS
  Safely updates RumiStack, validates it, then launches the local dashboard.
.DESCRIPTION
  Fast-forward only. Refuses to update a dirty or divergent checkout. RumiStack
  uses Node.js built-ins, so this workflow deliberately does not run npm install.
#>
[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)][int]$Port = 47821
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$url = "http://127.0.0.1:$Port"

function Step([string]$Message) { Write-Host "`n▶ $Message" -ForegroundColor Cyan }
function Ok([string]$Message) { Write-Host "  ✓ $Message" -ForegroundColor Green }
function StopWith([string]$Message) { throw $Message }

try {
    Set-Location -LiteralPath $root
    Step 'Checking prerequisites'
    foreach ($cmd in 'git','node') {
        if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { StopWith "$cmd is missing. Install Git for Windows and Node.js 20+, then retry." }
    }
    $nodeMajor = [int]((& node -p "process.versions.node.split('.')[0]") -join '')
    if ($nodeMajor -lt 20) { StopWith 'Node.js 20 or newer is required.' }
    Ok "Git available · Node.js $(& node --version)"

    if (-not (Test-Path -LiteralPath (Join-Path $root '.git'))) { StopWith 'This folder is not a Git checkout. Clone RumiStack first.' }
    $branch = (& git branch --show-current).Trim()
    if ($branch -ne 'main') { StopWith "Current branch is '$branch', not 'main'. Switch to main before using the one-click updater." }
    $remote = (& git remote get-url origin 2>$null)
    if ($LASTEXITCODE -ne 0 -or $remote -notmatch 'github\.com[:/]rumitech-solutions/RumiStack(?:\.git)?$') {
        StopWith 'The origin remote is not the official rumitech-solutions/RumiStack repository. Update cancelled.'
    }

    Step 'Protecting your local work'
    $dirty = & git status --porcelain
    if ($dirty) {
        Write-Host ($dirty | Select-Object -First 12) -ForegroundColor Yellow
        StopWith 'Local changes detected. Nothing was overwritten. Commit or back up your changes, then retry.'
    }
    Ok 'Working tree is clean'

    Step 'Checking GitHub for updates'
    & git fetch --prune origin main
    if ($LASTEXITCODE -ne 0) { StopWith 'Could not reach GitHub. Check your internet connection and try again.' }
    & git merge-base --is-ancestor HEAD origin/main
    if ($LASTEXITCODE -ne 0) {
        & git merge-base --is-ancestor origin/main HEAD
        if ($LASTEXITCODE -eq 0) { StopWith 'Your local main branch is ahead of GitHub. Push or back up local commits before updating.' }
        StopWith 'Local main and GitHub have diverged. Update cancelled to avoid losing commits.'
    }
    $behind = [int]((& git rev-list --count 'HEAD..origin/main').Trim())
    if ($behind -gt 0) {
        & git merge --ff-only origin/main
        if ($LASTEXITCODE -ne 0) { StopWith 'Fast-forward update failed. Your local work was not reset or discarded.' }
        Ok "Updated to latest main ($behind commit(s))"
    } else {
        Ok 'Already on the latest main'
    }

    Step 'Validating the updated workspace'
    & node scripts/check.js
    if ($LASTEXITCODE -ne 0) { StopWith 'Validation failed. The dashboard was not started.' }
    Ok 'Validation passed'

    Step 'Starting RumiStack'
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $pending = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        $alreadyRunning = $pending.AsyncWaitHandle.WaitOne(500)
        if ($alreadyRunning) {
            try { $client.EndConnect($pending); $alreadyRunning = $client.Connected } catch { $alreadyRunning = $false }
        }
    } finally { $client.Dispose() }

    if ($alreadyRunning) {
        Ok "RumiStack is already running at $url"
        Start-Process $url
        exit 0
    }

    Ok "Opening $url"
    & (Join-Path $PSScriptRoot 'Start-Workspace.ps1') -Port $Port
    if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} catch {
    Write-Host "`n✕ $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'No local files or project folders were deleted.' -ForegroundColor DarkGray
    exit 1
}
