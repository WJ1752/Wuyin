@echo off
setlocal
cd /d "%~dp0.."
where pnpm.cmd >nul 2>&1 || (
  echo Please install Node.js 22.18+ and pnpm, then open this file again.
  pause
  exit /b 1
)
node -e "require.resolve('vite'); require.resolve('tsx'); require.resolve('terser')" >nul 2>&1
if errorlevel 1 (
  call pnpm.cmd install --frozen-lockfile
  if errorlevel 1 goto failed
)
call pnpm.cmd play --open %1
if not errorlevel 1 exit /b 0
:failed
echo Game startup failed. See the message above.
pause
exit /b 1
