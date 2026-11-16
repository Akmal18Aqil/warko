@echo off
REM =============================================================================
REM  GATI POS - Jalankan backend (Laravel) + frontend (Vite/React) sekaligus.
REM  Pakai:  start.bat                  -> start keduanya
REM          start.bat -Services frontend   -> hanya frontend
REM          start.bat -Services backend    -> hanya backend
REM =============================================================================
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start.ps1" %*
if /i "%~1"=="" pause
endlocal
