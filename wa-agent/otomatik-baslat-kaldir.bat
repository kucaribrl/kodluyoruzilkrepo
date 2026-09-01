@echo off
title IQ Basics - WhatsApp Otomatik Baslatmayi Kaldir
cd /d "%~dp0"

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LNK=%STARTUP%\IQ Basics WhatsApp.lnk"

echo.
if not exist "%LNK%" goto yokzaten
del "%LNK%"
echo [OK] Otomatik baslatma kaldirildi.
echo      Artik bilgisayar acildiginda kendiliginden calismayacak.
goto durdur

:yokzaten
echo [i] Otomatik baslatma zaten kurulu degil.

:durdur
echo.
echo Arka planda calisan WhatsApp ajani durduruluyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*baslat.js*iqwa*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*wa-oturum*' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
echo.
echo Tekrar baslatmak icin: baslat.bat (gorunur)
echo veya otomatik-baslat-kur.bat (gizli / her acilista otomatik).
echo.
pause
