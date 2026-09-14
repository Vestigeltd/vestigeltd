@echo off
setlocal
cd /d "%~dp0"
echo.
echo Vestige V35.28.1 - Full Validation
echo ==================================
echo.
echo [1/2] Running project verification and regression suite...
call npm run check
if errorlevel 1 (
  echo.
  echo VALIDATION FAILED during npm run check.
  echo Do NOT upload or deploy this build.
  pause
  exit /b 1
)
echo.
echo [2/2] Running Cloudflare Wrangler dry-run...
call npx wrangler deploy --dry-run
if errorlevel 1 (
  echo.
  echo VALIDATION FAILED during Wrangler dry-run.
  echo Do NOT upload or deploy this build.
  pause
  exit /b 1
)
echo.
echo ==================================
echo V35.28.1 VALIDATION PASSED
echo No production deployment occurred.
echo ==================================
echo.
pause
endlocal
