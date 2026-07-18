@echo off
REM Double-click launcher for flush-for-gaming.ps1
REM Runs the PowerShell script (which then self-elevates to admin) from this same folder.
powershell -ExecutionPolicy Bypass -File "%~dp0flush-for-gaming.ps1"
