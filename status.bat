@echo off
REM =============================================================================
REM  GATI POS - Cek status backend (port 8000) + frontend (port 5173).
REM =============================================================================
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\status.ps1" %*
if /i "%~1"=="" pause
endlocal
