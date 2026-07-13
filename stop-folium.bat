@echo off
rem --- Stops the Folium server (whatever is listening on port 4173) ---
set "found="
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4173" ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
    set "found=1"
)
if defined found (
    echo Folium stopped.
) else (
    echo Folium was not running.
)
timeout /t 2 >nul
