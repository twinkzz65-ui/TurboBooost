@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
where dotnet >nul 2>&1
if errorlevel 1 (
  echo [ERROR] .NET 8 SDK is missing.
  echo Get it from https://dotnet.microsoft.com/download/dotnet/8.0
  pause
  exit /b 1
)
where docker >nul 2>&1
if not errorlevel 1 (
  echo Starting PostgreSQL via Docker Compose...
  docker compose up -d db
  if errorlevel 1 echo [WARN] Docker failed. Use your own PostgreSQL server instead.
) else (
  echo [INFO] Docker is not installed. PostgreSQL must already run locally.
  echo Setup PostgreSQL 15+ and set GODGRAM_DB to your connection string.
)
echo Restoring NuGet packages...
dotnet restore GodGram.csproj
if errorlevel 1 (
  echo [ERROR] dotnet restore failed. Check internet connectivity.
  pause
  exit /b 1
)
echo Setup complete. Next: start.bat
pause
