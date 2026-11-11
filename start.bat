@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
where dotnet >nul 2>&1
if errorlevel 1 (echo .NET 8 SDK is missing & pause & exit /b 1)
if not defined ASPNETCORE_URLS set "ASPNETCORE_URLS=http://127.0.0.1:8080"
if not defined GODGRAM_DB set "GODGRAM_DB=Host=localhost;Port=5432;Database=godgram;Username=godgram;Password=devpassword_change_me"
if not defined GODGRAM_DEV_CODES set "GODGRAM_DEV_CODES=1"
echo.
echo GodGram - http://127.0.0.1:8080/app
echo PostgreSQL required. Development login code will be printed here.
echo DO NOT expose this configuration publicly.
echo.
dotnet run --project GodGram.csproj
if errorlevel 1 (echo [ERROR] Application failed. Read the error above.)
pause
