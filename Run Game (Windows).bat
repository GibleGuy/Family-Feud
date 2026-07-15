@echo off
setlocal
cd /d "%~dp0"

echo Starting Family Feud local server...
echo.

REM Prefer the Python launcher (real install) over the WindowsApps stub
set "PY_CMD="
where py >nul 2>&1 && set "PY_CMD=py -3"
if not defined PY_CMD (
  where python >nul 2>&1 && set "PY_CMD=python"
)
if not defined PY_CMD (
  echo ERROR: Python was not found.
  echo Install Python from https://www.python.org/downloads/
  echo and check "Add python.exe to PATH" during setup.
  echo.
  pause
  exit /b 1
)

REM Free port 8192 if a previous server is stuck
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8192" ^| findstr "LISTENING"') do (
  echo Stopping old process on port 8192 ^(PID %%P^)...
  taskkill /F /PID %%P >nul 2>&1
)

echo Using: %PY_CMD%
echo Serving: %cd%
echo Open board: http://127.0.0.1:8192
echo Open admin: http://127.0.0.1:8192/admin.html
echo.
echo Keep this window open while you play. Press Ctrl+C to stop.
echo.

start "" "http://127.0.0.1:8192"

%PY_CMD% -m http.server 8192 --bind 127.0.0.1
if errorlevel 1 (
  echo.
  echo Server failed to start.
  pause
)
