<#
.SYNOPSIS
  Read-only health report: prerequisites, profile status on this laptop, repository hygiene.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\Common.ps1')
$root = Get-RumiRoot
$issues = 0

Write-Step 'Prerequisites'
if (Test-Command 'git')  { Write-Ok ((& git --version)) } else { Write-Warning 'git missing'; $issues++ }
$nv = Get-NodeVersion
if ($nv -and $nv -ge [version]'20.0.0') { Write-Ok "node $nv" } else { Write-Warning 'Node.js 20+ missing'; $issues++ }
if ($nv -and $nv -ge [version]'22.20.0') { Write-Ok 'Node meets the Skills CLI requirement (22.20+)' } else { Write-Skip 'Node is below 22.20; Restore-Skills.ps1 will refuse to install' }
foreach ($c in 'winget', 'gh', 'docker', 'code') {
    if (Test-Command $c) { Write-Ok $c } else { Write-Skip "$c not found (optional)" }
}

Write-Step 'Tools in your device profile'
$registry = Read-JsonFile (Join-Path $root 'registry\tools.json')
$profile  = Read-JsonFile (Join-Path $root 'config\portable-profile.json')
$byId = @{}; foreach ($t in $registry.tools) { $byId[$t.id] = $t }
foreach ($id in (Get-JsonArray $profile.tools)) {
    if (-not $byId.ContainsKey($id)) { Write-Warning "Unknown tool in profile: $id"; $issues++; continue }
    $t = $byId[$id]
    if (-not $t.command) { Write-Manual "$($t.name): cannot be detected on PATH; verify manually." }
    elseif (Test-Command $t.command) { Write-Ok $t.name }
    else { Write-Warning "$($t.name) is missing  ($($t.install.type))"; $issues++ }
}

Write-Step 'Repository'
if ((Test-Command 'git') -and (Test-Path -LiteralPath (Join-Path $root '.git'))) {
    Push-Location $root
    try {
        $dirty = (& git status --porcelain)
        if ($dirty) { Write-Skip 'working tree has uncommitted changes' } else { Write-Ok 'working tree clean' }
        $tracked = (& git ls-files) -join "`n"
        foreach ($bad in '^sources/', '^projects/', '^logs/', '^backups/', '^state/', '(^|/)\.env') {
            if ($tracked -match "(?m)$bad") { Write-Warning "Git is tracking a local-only path matching $bad"; $issues++ }
        }
    } finally { Pop-Location }
}
Push-Location $root
try { & node scripts/check.js; if ($LASTEXITCODE -ne 0) { $issues++ } } finally { Pop-Location }

Write-Host ''
if ($issues -eq 0) { Write-Host 'Doctor: no problems found.' -ForegroundColor Green } else { Write-Host "Doctor: $issues item(s) need attention." -ForegroundColor Yellow }
exit ([int]($issues -gt 0))
