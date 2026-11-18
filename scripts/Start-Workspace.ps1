<#
.SYNOPSIS
  Starts the local RumiStack dashboard on 127.0.0.1 and opens it in your default browser. Does not update or pull Git repositories.
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

# Reuse an existing RumiStack instance instead of starting a duplicate.
$client = New-Object System.Net.Sockets.TcpClient
$pending = $null
$alreadyListening = $false
try {
    $pending = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    $alreadyListening = $pending.AsyncWaitHandle.WaitOne(500)
    if ($alreadyListening) {
        try { $client.EndConnect($pending); $alreadyListening = $client.Connected }
        catch { $alreadyListening = $false }
    }
} finally {
    $client.Close()
    if ($pending) { $pending.AsyncWaitHandle.Close() }
}

if ($alreadyListening) {
    try {
        $meta = Invoke-RestMethod -Uri "$url/api/meta" -Method Get -TimeoutSec 3
        if ($meta.name -eq 'RumiStack') {
            Write-Host "RumiStack is already running: $url" -ForegroundColor Green
            if (-not $NoBrowser) { Start-Process $url }
            return
        }
    } catch {
        # A different application owns the port; report it below.
    }
    throw "Port $Port is already in use by another application. Close it or start RumiStack with -Port 48000."
}

if (-not $NoBrowser) {
    # Open the browser shortly after the server has had time to bind.
    Start-Job -ScriptBlock { param($u) Start-Sleep -Seconds 2; Start-Process $u } -ArgumentList $url | Out-Null
}

Write-Host "RumiStack dashboard: $url  (Ctrl+C to stop)" -ForegroundColor Green
$env:RUMISTACK_PORT = "$Port"
Push-Location $root
try { & node server/index.js }
finally { Pop-Location }
