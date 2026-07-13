@echo off
rem --- Folium launcher: serves the built app and opens it in your browser ---
cd /d "%~dp0"

rem Install deps the first time only
if not exist "node_modules" (
    call npm install
)

rem Build the app the first time (delete the dist folder to force a rebuild after code changes)
if not exist "dist" (
    call npm run build
)

rem Open the browser after a short delay, then serve the built app.
rem The server exits by itself ~20s after the last Folium tab is closed.
start "" cmd /c "timeout /t 2 >nul & start http://localhost:4173"
node serve.mjs
