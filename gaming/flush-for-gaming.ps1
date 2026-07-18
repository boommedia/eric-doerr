# flush-for-gaming.ps1
# Frees RAM/CPU after a long VS Code + AI session, before launching a game.
# Run: right-click > "Run with PowerShell", or from a terminal: powershell -ExecutionPolicy Bypass -File .\flush-for-gaming.ps1

# --- Self-elevate to admin (needed to empty standby RAM) ---
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Write-Host "=== Flush for Gaming ===" -ForegroundColor Cyan

# --- 1. Show top RAM users before ---
Write-Host "`nTop RAM users BEFORE:" -ForegroundColor Yellow
Get-Process | Sort-Object WorkingSet64 -Descending |
    Select-Object -First 10 Name, @{n='RAM(MB)';e={[math]::Round($_.WorkingSet64/1MB)}} |
    Format-Table -AutoSize

# --- 2. Kill VS Code and leftover dev/AI helpers ---
Write-Host "Closing VS Code and language/AI servers..." -ForegroundColor Yellow
$targets = 'Code','node','esbuild','rg','tsserver','Copilot*','*language-server*','vsls-agent'
Get-Process $targets -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# --- 3. Clear temp files ---
Write-Host "Clearing temp files..." -ForegroundColor Yellow
Remove-Item "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue

# --- 4. Empty standby RAM (needs RAMMap or EmptyStandbyList) ---
# Set the path to whichever tool you downloaded from Microsoft Sysinternals.
$rammap = "C:\Tools\RAMMap64.exe"        # https://learn.microsoft.com/sysinternals/downloads/rammap
$emptysl = "C:\Tools\EmptyStandbyList.exe" # lighter alternative

if (Test-Path $rammap) {
    Write-Host "Emptying standby RAM via RAMMap..." -ForegroundColor Yellow
    & $rammap -Et
} elseif (Test-Path $emptysl) {
    Write-Host "Emptying standby RAM via EmptyStandbyList..." -ForegroundColor Yellow
    & $emptysl standbylist
} else {
    Write-Host "No RAMMap/EmptyStandbyList found in C:\Tools - skipping standby flush." -ForegroundColor DarkGray
    Write-Host "  (Download RAMMap from Microsoft Sysinternals and drop RAMMap64.exe in C:\Tools to enable this.)" -ForegroundColor DarkGray
}

# --- 5. Restart Explorer to clear its bloat ---
Write-Host "Restarting Explorer..." -ForegroundColor Yellow
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
if (-not (Get-Process explorer -ErrorAction SilentlyContinue)) { Start-Process explorer }

# --- 6. Show result ---
Start-Sleep -Seconds 2
Write-Host "`nTop RAM users AFTER:" -ForegroundColor Green
Get-Process | Sort-Object WorkingSet64 -Descending |
    Select-Object -First 10 Name, @{n='RAM(MB)';e={[math]::Round($_.WorkingSet64/1MB)}} |
    Format-Table -AutoSize

Write-Host "Done. Happy gaming." -ForegroundColor Cyan
Start-Sleep -Seconds 3
