<#
.SYNOPSIS
  Installs the skills selected in config\skills-profile.json using the Vercel Skills CLI (npx skills).
.DESCRIPTION
  Source and skill IDs are looked up in registry\skills.json; nothing outside that catalogue is executed.
  Plugin-style and discovery-only sources are never installed. Use -WhatIf to preview, -Confirm per action.
  Project-scoped skills require -ProjectPath pointing at a real project (never the RumiStack folder).
#>
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [string]$ProfilePath,
    [string]$ProjectPath
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\Common.ps1')
$root = Get-RumiRoot
if (-not $ProfilePath) { $ProfilePath = Join-Path $root 'config\skills-profile.json' }

$catalogue = Read-JsonFile (Join-Path $root 'registry\skills.json')
$profile   = Read-JsonFile $ProfilePath
$sources = @{}; foreach ($s in $catalogue.sources) { $sources[$s.id] = $s }
$assistants = @($catalogue.assistants | ForEach-Object { $_.id })
$selections = Get-JsonArray $profile.selections

if ($selections.Count -eq 0) { Write-Host 'No skills selected in the profile. Nothing to do.'; return }

# Vercel's CLI requires a recent Node. In preview mode a low version is only a warning.
$minNode = [version]'22.20.0'
if (-not (Test-NodeAtLeast $minNode)) {
    $msg = "Node.js $minNode or newer is required for the Skills CLI (found: $(Get-NodeVersion))."
    if ($WhatIfPreference) { Write-Warning $msg } else { throw $msg }
}

# ---- project path protection
$resolvedProject = $null
if ($ProjectPath) {
    if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) { throw "ProjectPath does not exist: $ProjectPath" }
    $resolvedProject = (Resolve-Path -LiteralPath $ProjectPath).Path.TrimEnd('\')
    if ($resolvedProject -ieq $root.TrimEnd('\') -or $resolvedProject.StartsWith($root.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'ProjectPath must be one of your real projects, not the RumiStack folder or a folder inside it.'
    }
}

Write-Step "Skills ($($selections.Count))"
foreach ($sel in $selections) {
    foreach ($v in @($sel.source, $sel.skill)) { if (-not (Test-SafeId $v)) { throw "Invalid id in skills profile: '$v'" } }
    if (-not $sources.ContainsKey($sel.source)) { throw "Unknown skills source '$($sel.source)'." }
    $src = $sources[$sel.source]
    if (-not $src.installable) { Write-Manual "$($src.name) is $($src.tier); install it manually. $($src.url)"; continue }
    if ($src.repo -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw "Unsafe repo reference for '$($src.id)'." }
    if (-not ($src.skills | Where-Object { $_.id -eq $sel.skill })) { throw "Skill '$($sel.skill)' is not listed for '$($sel.source)'." }

    $agentArgs = @()
    foreach ($a in (Get-JsonArray $sel.assistants)) {
        if ($assistants -notcontains $a) { throw "Unsupported assistant '$a'." }
        $agentArgs += @('--agent', $a)
    }
    if ($agentArgs.Count -eq 0) { throw "Selection '$($sel.skill)' has no assistants." }

    $cliArgs = @('--yes', 'skills', 'add', $src.repo, '--skill', $sel.skill) + $agentArgs
    $location = $null
    if ($sel.scope -eq 'global') { $cliArgs += '--global' }
    elseif ($sel.scope -eq 'project') {
        if (-not $resolvedProject) { Write-Manual "'$($sel.skill)' is project-scoped. Re-run with -ProjectPath <your project>."; continue }
        $location = $resolvedProject
    } else { throw "Unknown scope '$($sel.scope)'." }
    $cliArgs += '--yes'

    $label = "npx $($cliArgs -join ' ')"
    if ($PSCmdlet.ShouldProcess($label, "Install skill $($sel.skill) from $($src.repo)")) {
        if ($location) { Push-Location -LiteralPath $location }
        try { & npx @cliArgs; if ($LASTEXITCODE -eq 0) { Write-Ok "$($sel.skill)" } else { Write-Warning "$($sel.skill): exit code $LASTEXITCODE" } }
        finally { if ($location) { Pop-Location } }
    }
}

Write-Host ''
Write-Host 'Reminder: skills can carry instructions and scripts. Review each upstream source before trusting it.' -ForegroundColor Yellow
