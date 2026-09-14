@echo off
setlocal
cd /d "%~dp0"
echo.
echo Vestige V35.28.1 - Upload Preview Version
echo ==========================================
echo.
echo This uploads a Worker VERSION for preview only.
echo It does NOT move production traffic.
echo.
call npx wrangler versions upload --message "V35.28.1 owner lock visibility correction - preview"
if errorlevel 1 (
  echo.
  echo Preview upload failed. Nothing was promoted to production.
  pause
  exit /b 1
)
echo.
echo Copy the Worker Version ID and Version Preview URL shown above to Robbie.
echo Do NOT promote this version until the preview audit is complete.
echo.
pause
endlocal
