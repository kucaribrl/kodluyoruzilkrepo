@echo off
title IQ Basics - WhatsApp Ajanini Durdur
cd /d "%~dp0"
echo.
echo Arka planda calisan WhatsApp ajani durduruluyor...
rem Sadece IQ Basics WhatsApp ajanini kapatir (diger Node uygulamalarina DOKUNMAZ)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*baslat.js*iqwa*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*wa-oturum*' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
echo [OK] Ajan durduruldu (calisiyorduysa).
echo     Tekrar baslatmak icin: baslat.bat (gorunur) veya bilgisayari yeniden baslat (gizli).
echo.
pause
