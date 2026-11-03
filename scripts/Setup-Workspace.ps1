<#
.SYNOPSIS
  Prepares a RumiStack folder: checks prerequisites, creates local-only directories, runs the validation.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\Common.ps1')
$root = Get-RumiRoot

Write-Step 'Checking prerequisites'
$missing = @()
if (-not (Test-Command 'git')) { $missing += 'Git for Windows (winget install --id Git.Git --exact)' }
if (-not (Test-NodeAtLeast ([version]'20.0.0'))) { $missing += 'Node.js 20 or newer (winget install --id OpenJS.NodeJS.LTS --exact)' }
if ($missing.Count -gt 0) {
    $missing | ForEach-Object { Write-Warning "Missing: $_" }
    throw 'Install the prerequisites above, open a NEW PowerShell window, and run this script again.'
}
Write-Ok "git $((& git --version) -replace 'git version ','')"
Write-Ok "node $(& node --version)"
if (Test-Command 'gh') { Write-Ok 'GitHub CLI found' } else { Write-Skip 'GitHub CLI (gh) not found; only needed for Publish-To-GitHub.ps1' }

Write-Step 'Creating local-only folders (all are git-ignored)'
foreach ($dir in 'sources', 'projects', 'logs', 'backups', 'state') {
    $path = Join-Path $root $dir
    if (-not (Test-Path -LiteralPath $path)) { New-Item -ItemType Directory -Path $path | Out-Null; Write-Ok "created $dir\" }
    else { Write-Skip "$dir\ already exists" }
}

Write-Step 'Running validation'
Push-Location $root
try { & node scripts/check.js; if ($LASTEXITCODE -ne 0) { throw 'npm run check failed' } }
finally { Pop-Location }

Write-Host ''
Write-Host 'Setup complete. Next: .\scripts\Start-Workspace.ps1' -ForegroundColor Green
