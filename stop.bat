@echo off
REM =============================================================================
REM  GATI POS - Hentikan backend (port 8000) + frontend (port 5173).
REM  Pakai:  stop.bat                  -> stop keduanya
REM          stop.bat -Services frontend   -> hanya frontend
REM          stop.bat -Services backend    -> hanya backend
REM =============================================================================
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop.ps1" %*
if /i "%~1"=="" pause
endlocal
