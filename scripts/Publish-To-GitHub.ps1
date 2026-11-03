<#
.SYNOPSIS
  Optional: creates a NEW private GitHub repository for this folder and pushes it.
.DESCRIPTION
  Refuses to run if the repository already exists on GitHub or if a different 'origin' is configured.
  If you already created the repository, use ordinary git commands instead.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9-]{1,39}$')][string]$Owner,
    [Parameter(Mandatory)][ValidatePattern('^[A-Za-z0-9._-]{1,100}$')][string]$RepositoryName,
    [ValidateSet('private', 'public')][string]$Visibility = 'private'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\Common.ps1')
$root = Get-RumiRoot
foreach ($c in 'git', 'gh') { if (-not (Test-Command $c)) { throw "$c is required." } }

& gh auth status | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Run "gh auth login" first.' }
$who = (& gh api user --jq .login)
Write-Host "Authenticated as: $who"
if ($who -ine $Owner) { Write-Warning "Authenticated user '$who' differs from owner '$Owner' (fine for an organization you belong to)." }

& gh repo view "$Owner/$RepositoryName" 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { throw "$Owner/$RepositoryName already exists. Inspect it and use ordinary git commands; this script only creates new repositories." }

Push-Location $root
try {
    if (-not (Test-Path -LiteralPath (Join-Path $root '.git'))) { & git init -b main | Out-Null }
    $remote = (& git remote get-url origin 2>$null)
    if ($remote) { throw "A remote 'origin' is already configured ($remote). Refusing to continue." }

    & git add -A
    Write-Host "`nFiles that will be committed:" -ForegroundColor Cyan
    & git status --short
    if ($Visibility -eq 'public') { Write-Warning 'The repository will be PUBLIC.' }
    $answer = Read-Host "`nType YES to create $Visibility repository $Owner/$RepositoryName and push"
    if ($answer -cne 'YES') { Write-Host 'Cancelled. Nothing was created.'; & git reset | Out-Null; return }

    & git commit -m 'Initial RumiStack commit'
    & gh repo create "$Owner/$RepositoryName" "--$Visibility" --source . --remote origin --push
    if ($LASTEXITCODE -ne 0) { throw 'gh repo create failed.' }
    Write-Host "Published: https://github.com/$Owner/$RepositoryName" -ForegroundColor Green
} finally { Pop-Location }
