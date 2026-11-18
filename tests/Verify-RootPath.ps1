$ErrorActionPreference = 'Stop'

$expectedRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
. (Join-Path $expectedRoot 'scripts\lib\Common.ps1')

$actualRoot = Get-RumiRoot
$expected = [System.IO.Path]::GetFullPath($expectedRoot).TrimEnd('\', '/')
$actual = [System.IO.Path]::GetFullPath($actualRoot).TrimEnd('\', '/')

if (-not [string]::Equals($actual, $expected, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Get-RumiRoot returned '$actual'; expected '$expected'."
}

$serverEntry = Join-Path $actualRoot 'server\index.js'
if (-not (Test-Path -LiteralPath $serverEntry -PathType Leaf)) {
    throw "Server entry point missing at expected path: $serverEntry"
}

Write-Host "PowerShell root detection passed: $actual" -ForegroundColor Green
