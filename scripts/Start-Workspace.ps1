<#
.SYNOPSIS
  Starts the local RumiStack dashboard on 127.0.0.1 and opens it in your browser.
#>
[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)][int]$Port = 47821,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\Common.ps1')
$root = Get-RumiRoot

if (-not (Test-NodeAtLeast ([version]'20.0.0'))) { throw 'Node.js 20+ is required. Install it, then open a new PowerShell window.' }

$url = "http://127.0.0.1:$Port"
if (-not $NoBrowser) {
    # Open the browser shortly after the server has had time to bind.
    Start-Job -ScriptBlock { param($u) Start-Sleep -Seconds 2; Start-Process $u } -ArgumentList $url | Out-Null
}

Write-Host "RumiStack dashboard: $url  (Ctrl+C to stop)" -ForegroundColor Green
$env:RUMISTACK_PORT = "$Port"
Push-Location $root
try { & node server/index.js }
finally { Pop-Location }
