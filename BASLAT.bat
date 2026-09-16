@echo off
cd /d "%~dp0"
echo.
echo Portfoy sunucusu basliyor...
echo Tarayici: http://localhost:3000
echo Durdurmak icin bu pencereyi kapat veya Ctrl+C
echo.

where python >nul 2>&1
if %ERRORLEVEL%==0 (
  start "" http://localhost:3000
  python -m http.server 3000
  goto :eof
)

where py >nul 2>&1
if %ERRORLEVEL%==0 (
  start "" http://localhost:3000
  py -m http.server 3000
  goto :eof
)

where npx >nul 2>&1
if %ERRORLEVEL%==0 (
  start "" http://localhost:3000
  npx --yes serve -l 3000 .
  goto :eof
)

echo Python veya Node bulunamadi.
echo Bunun yerine index.html dosyasina cift tikla.
pause
start "" "%~dp0index.html"
