<#
.SYNOPSIS
  Shallow-clones selected reference repositories into the git-ignored sources\ folder.
.EXAMPLE
  .\scripts\Clone-Sources.ps1 -Ids superpowers,playwright-mcp -WhatIf
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory)][string[]]$Ids
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\Common.ps1')
$root = Get-RumiRoot
if (-not (Test-Command 'git')) { throw 'git is required.' }

$registry = Read-JsonFile (Join-Path $root 'registry\tools.json')
$byId = @{}; foreach ($t in $registry.tools) { $byId[$t.id] = $t }

foreach ($id in $Ids) {
    if (-not (Test-SafeId $id) -or -not $byId.ContainsKey($id) -or -not (Get-Prop $byId[$id] 'clone' $false)) {
        throw "'$id' is not on the source-clone allowlist. Allowed: $((($registry.tools | Where-Object { Get-Prop $_ 'clone' $false }).id) -join ', ')"
    }
    $tool = $byId[$id]
    if (-not (Test-GitHubHttpsUrl $tool.repo)) { throw "Registry URL for '$id' is not an allowed GitHub HTTPS URL." }
    $dest = Join-Path $root "sources\$id"
    if (Test-Path -LiteralPath $dest) { Write-Skip "sources\$id already exists (use Update-Workspace.ps1)"; continue }
    New-Item -ItemType Directory -Path (Join-Path $root 'sources') -Force | Out-Null
    if ($PSCmdlet.ShouldProcess("git clone --depth 1 $($tool.repo) sources\$id", "Clone $($tool.name)")) {
        & git clone --depth 1 $tool.repo $dest
        if ($LASTEXITCODE -eq 0) { Write-Ok "cloned $id" } else { Write-Warning "clone failed for $id" }
    }
}
