@echo off
echo Starting Family Feud Local Server...
start "" python -m http.server 8192 --bind 127.0.0.1
timeout /t 2 /nobreak >nul
start http://127.0.0.1:8192
