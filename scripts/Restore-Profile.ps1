<#
.SYNOPSIS
  Restores the tools, source checkouts and VS Code extensions listed in config\portable-profile.json.
.DESCRIPTION
  Only typed, allow-listed installers from registry\tools.json are executed (winget or npm).
  Everything else is reported as a manual step with its official docs link.
  Use -WhatIf to preview and -Confirm to approve each action.
#>
[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [string]$ProfilePath
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\Common.ps1')
$root = Get-RumiRoot
if (-not $ProfilePath) { $ProfilePath = Join-Path $root 'config\portable-profile.json' }

$registry = Read-JsonFile (Join-Path $root 'registry\tools.json')
$profile  = Read-JsonFile $ProfilePath
$byId = @{}
foreach ($t in $registry.tools) { $byId[$t.id] = $t }

$toolIds   = Get-JsonArray $profile.tools
$sourceIds = Get-JsonArray $profile.sources
$extIds    = Get-JsonArray $profile.vscodeExtensions

# ---- validate the profile before doing anything
foreach ($id in $toolIds) {
    if (-not (Test-SafeId $id)) { throw "Invalid tool id in profile: '$id'" }
    if (-not $byId.ContainsKey($id)) { throw "Profile references unknown tool '$id'." }
}
foreach ($id in $sourceIds) {
    if (-not (Test-SafeId $id) -or -not $byId.ContainsKey($id) -or -not (Get-Prop $byId[$id] 'clone' $false)) { throw "'$id' is not on the source-clone allowlist." }
}
foreach ($ext in $extIds) {
    if ($ext -notmatch '^[A-Za-z0-9][A-Za-z0-9-]*\.[A-Za-z0-9][A-Za-z0-9-]*$') { throw "Invalid VS Code extension id: '$ext'" }
}

# Install infrastructure (git, node...) before tools that depend on it.
$order = @{ infrastructure = 0; assistants = 1; gateways = 2; 'skills-agents' = 3; mcp = 4; testing = 5; security = 6 }
$tools = @($toolIds | ForEach-Object { $byId[$_] } | Sort-Object { $order[$_.category] })

$summary = [ordered]@{ installed = 0; present = 0; manual = 0; failed = 0 }
$needNewShell = $false

Write-Step "Tools ($($tools.Count))"
foreach ($tool in $tools) {
    if ($tool.command -and (Test-Command $tool.command)) { Write-Skip "$($tool.name) already on PATH"; $summary.present++; continue }

    switch ($tool.install.type) {
        'winget' {
            $pkg = $tool.install.package
            if (-not (Test-WingetId $pkg)) { throw "Refusing unsafe winget id '$pkg'." }
            if (-not (Test-Command 'winget')) { Write-Manual "$($tool.name): winget not found. Install '$pkg' manually: $($tool.docs)"; $summary.manual++; continue }
            if ($PSCmdlet.ShouldProcess("winget install --id $pkg --exact", "Install $($tool.name)")) {
                & winget install --id $pkg --exact --accept-source-agreements --accept-package-agreements
                if ($LASTEXITCODE -eq 0) { Write-Ok "$($tool.name) installed"; $summary.installed++; $needNewShell = $true }
                else { Write-Warning "$($tool.name): winget exited with code $LASTEXITCODE"; $summary.failed++ }
            }
        }
        'npm' {
            $pkg = $tool.install.package
            if (-not (Test-NpmPackage $pkg)) { throw "Refusing unsafe npm package name '$pkg'." }
            $min = [version]::new([int]$tool.install.minNode, 0, 0)
            if (-not (Test-Command 'npm') -or -not (Test-NodeAtLeast $min)) {
                Write-Manual "$($tool.name) needs Node.js $($tool.install.minNode)+ and npm. Install Node first, open a new PowerShell window, then re-run."
                $summary.manual++; continue
            }
            if ($PSCmdlet.ShouldProcess("npm install -g $pkg", "Install $($tool.name)")) {
                & npm install -g $pkg
                if ($LASTEXITCODE -eq 0) { Write-Ok "$($tool.name) installed"; $summary.installed++ }
                else { Write-Warning "$($tool.name): npm exited with code $LASTEXITCODE"; $summary.failed++ }
            }
        }
        default {
            Write-Manual "$($tool.name): $($tool.install.note)  Docs: $($tool.docs)"
            $summary.manual++
        }
    }
}

# ---- optional source checkouts (shallow, allow-listed, never overwritten)
if ($sourceIds.Count -gt 0) {
    Write-Step "Source checkouts ($($sourceIds.Count))"
    if (-not (Test-Command 'git')) { Write-Warning 'git not found; skipping source checkouts.' }
    else {
        foreach ($id in $sourceIds) {
            $tool = $byId[$id]
            if (-not (Test-GitHubHttpsUrl $tool.repo)) { throw "Registry URL for '$id' is not an allowed GitHub HTTPS URL." }
            $dest = Join-Path $root "sources\$id"
            if (Test-Path -LiteralPath $dest) { Write-Skip "sources\$id exists"; continue }
            if ($PSCmdlet.ShouldProcess("git clone --depth 1 $($tool.repo) sources\$id", "Clone $($tool.name)")) {
                & git clone --depth 1 $tool.repo $dest
                if ($LASTEXITCODE -eq 0) { Write-Ok "cloned $id" } else { Write-Warning "clone failed for $id"; $summary.failed++ }
            }
        }
    }
}

# ---- VS Code extensions
if ($extIds.Count -gt 0) {
    Write-Step "VS Code extensions ($($extIds.Count))"
    if (-not (Test-Command 'code')) { Write-Manual "VS Code 'code' command not found. Install VS Code (or add it to PATH) and re-run." }
    else {
        foreach ($ext in $extIds) {
            if ($PSCmdlet.ShouldProcess("code --install-extension $ext", "Install VS Code extension $ext")) {
                & code --install-extension $ext
                if ($LASTEXITCODE -eq 0) { Write-Ok $ext } else { Write-Warning "extension failed: $ext"; $summary.failed++ }
            }
        }
    }
}

Write-Host ''
Write-Host ("Done. installed={0} already-present={1} manual={2} failed={3}" -f $summary.installed, $summary.present, $summary.manual, $summary.failed)
if ($needNewShell) { Write-Host 'Open a NEW PowerShell window so newly installed tools appear on PATH.' -ForegroundColor Yellow }
Write-Host 'Secrets, logins and gateway keys are never restored. Re-authenticate each tool on this laptop.'
