# MyOffice Daemon Installer
# Run as Administrator in PowerShell

param(
    [string]$HqUrl = "",
    [string]$HqApiKey = "",
    [string]$RedisUrl = "",
    [string]$AgentsDir = ""
)

$ErrorActionPreference = "Stop"
$DaemonName = "MyOfficeDaemon"
$AppDir = "$env:APPDATA\MyOffice"
$LogDir = "$env:PROGRAMDATA\MyOffice"
$ConfigFile = "$AppDir\daemon.toml"

Write-Host "=== MyOffice Daemon Installer ===" -ForegroundColor Cyan

# Require admin
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Run this script as Administrator."
    exit 1
}

# Collect config interactively if not provided
if (-not $HqUrl) {
    $HqUrl = Read-Host "HQ URL (e.g. https://cowork.lotview.ai)"
}
if (-not $HqApiKey) {
    $HqApiKey = Read-Host "Daemon API key (COWORK_DAEMON_TOKEN from Render)"
}
if (-not $RedisUrl) {
    $RedisUrl = Read-Host "Redis URL (rediss://... from Render)"
}
if (-not $AgentsDir) {
    $defaultAgents = "$env:USERPROFILE\.claude\agents"
    $AgentsDir = Read-Host "Agents directory [$defaultAgents]"
    if (-not $AgentsDir) { $AgentsDir = $defaultAgents }
}

# Generate daemon ID
$DaemonId = [System.Guid]::NewGuid().ToString()

# Create directories
New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# Write daemon.toml
$config = @"
hq_url      = "$HqUrl"
hq_api_key  = "$HqApiKey"
redis_url   = "$RedisUrl"
daemon_id   = "$DaemonId"
agents_dir  = "$($AgentsDir -replace '\\', '\\')"
log_level   = "info"
task_timeout_ms = 1800000
"@
$config | Out-File -FilePath $ConfigFile -Encoding UTF8
Write-Host "[+] Config written to $ConfigFile" -ForegroundColor Green

# Check Node.js
$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Node.js is not installed. Install Node.js 20+ from https://nodejs.org"
    exit 1
}
Write-Host "[+] Node.js $nodeVersion found" -ForegroundColor Green

# Check if claude CLI is available
$claudeVersion = claude --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Warning "claude CLI not found in PATH. Install Claude Code from https://claude.ai/code"
} else {
    Write-Host "[+] Claude CLI $claudeVersion found" -ForegroundColor Green
}

# Install NSSM if not present
$nssmPath = Get-Command nssm -ErrorAction SilentlyContinue
if (-not $nssmPath) {
    Write-Host "[*] Installing NSSM via winget..." -ForegroundColor Yellow
    winget install -e --id NSSM.NSSM --accept-source-agreements --accept-package-agreements
    $nssmPath = "nssm"
}

# Install daemon service
$daemonScript = "$PSScriptRoot\dist\daemon\index.js"
if (-not (Test-Path $daemonScript)) {
    $daemonScript = "$AppDir\daemon\index.js"
}

nssm install $DaemonName node
nssm set $DaemonName AppDirectory $PSScriptRoot
nssm set $DaemonName AppParameters $daemonScript
nssm set $DaemonName AppEnvironmentExtra "DAEMON_CONFIG=$ConfigFile" "ANTHROPIC_API_KEY=$($env:ANTHROPIC_API_KEY)"
nssm set $DaemonName AppStdout "$LogDir\daemon.log"
nssm set $DaemonName AppStderr "$LogDir\daemon-error.log"
nssm set $DaemonName AppRotateFiles 1
nssm set $DaemonName AppRotateSeconds 86400
nssm set $DaemonName Start SERVICE_AUTO_START
nssm set $DaemonName ObjectName LocalSystem

Write-Host "[+] NSSM service installed" -ForegroundColor Green

# Start service
nssm start $DaemonName
Start-Sleep -Seconds 3

$status = nssm status $DaemonName
Write-Host "[+] Service status: $status" -ForegroundColor $(if ($status -eq "SERVICE_RUNNING") { "Green" } else { "Yellow" })

Write-Host ""
Write-Host "=== Installation complete ===" -ForegroundColor Cyan
Write-Host "Daemon ID: $DaemonId"
Write-Host "Config: $ConfigFile"
Write-Host "Logs: $LogDir\daemon.log"
Write-Host ""
Write-Host "To check status: nssm status $DaemonName"
Write-Host "To stop:         nssm stop $DaemonName"
Write-Host "To restart:      nssm restart $DaemonName"
Write-Host "To uninstall:    nssm remove $DaemonName confirm"
