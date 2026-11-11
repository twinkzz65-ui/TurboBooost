@echo off
chcp 65001 >nul
cd /d "%~dp0"
python godgram_server.py --lan
pause
