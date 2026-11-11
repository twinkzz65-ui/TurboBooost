@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
if not exist "GodGram.exe" (
  echo [ERROR] GodGram.exe not found. Extract the whole Windows artifact first.
  pause
  exit /b 1
)
if not defined ASPNETCORE_URLS set "ASPNETCORE_URLS=http://127.0.0.1:8080"
if not defined GODGRAM_DB set "GODGRAM_DB=Host=localhost;Port=5432;Database=godgram;Username=godgram;Password=devpassword_change_me"
if not defined GODGRAM_DEV_CODES set "GODGRAM_DEV_CODES=1"
echo.
echo GodGram: http://127.0.0.1:8080/app
echo PostgreSQL MUST be running separately.
echo DEVELOPMENT MODE ONLY. Do not expose this app to the internet with dev codes.
echo.
GodGram.exe
if errorlevel 1 echo [ERROR] Failed to start. Verify PostgreSQL connection and configuration.
pause
