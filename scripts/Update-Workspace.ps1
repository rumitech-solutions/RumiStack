<#
.SYNOPSIS
  Fast-forward-only update of RumiStack itself and of any clean source checkouts.
.DESCRIPTION
  Never merges, rebases or discards. A repository with local changes is skipped and reported.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\Common.ps1')
$root = Get-RumiRoot
if (-not (Test-Command 'git')) { throw 'git is required.' }

function Update-Repo {
    param([string]$Path, [string]$Label)
    if (-not (Test-Path -LiteralPath (Join-Path $Path '.git'))) { Write-Skip "$Label is not a git repository"; return }
    Push-Location -LiteralPath $Path
    try {
        if (& git status --porcelain) { Write-Skip "$Label has local changes; left untouched"; return }
        $out = & git pull --ff-only 2>&1
        if ($LASTEXITCODE -ne 0) { Write-Warning "$Label could not fast-forward: $($out | Select-Object -Last 1)"; return }
        if ($out -match 'Already up to date') { Write-Ok "$Label is up to date" } else { Write-Ok "$Label updated" }
    } finally { Pop-Location }
}

Write-Step 'RumiStack'
Update-Repo -Path $root -Label 'RumiStack'

$sources = Join-Path $root 'sources'
if (Test-Path -LiteralPath $sources) {
    Write-Step 'Source checkouts'
    Get-ChildItem -LiteralPath $sources -Directory | ForEach-Object { Update-Repo -Path $_.FullName -Label "sources\$($_.Name)" }
}

Write-Step 'Validation'
Push-Location $root
try { & node scripts/check.js } finally { Pop-Location }
