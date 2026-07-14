@echo off
rem --- Folium launcher ---
rem Everything lives in serve.mjs: it installs dependencies on first run,
rem rebuilds when the source changed (e.g. after a git pull), opens your
rem browser, and exits by itself ~20s after the last Folium tab is closed.
rem Requires Node.js (https://nodejs.org) to be installed.
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo Folium needs Node.js. Install it from https://nodejs.org and run this again.
    pause
    exit /b 1
)

node serve.mjs
