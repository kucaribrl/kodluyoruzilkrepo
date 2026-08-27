@echo off
title IQ Basics - Yazici Ajanini Durdur
cd /d "%~dp0"
echo.
echo Arka planda calisan yazici ajani durduruluyor...
rem Sadece IQ Basics ajanini calistiran node surecini kapatir (diger Node uygulamalarina DOKUNMAZ)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*agent.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
echo [OK] Ajan durduruldu (calisiyorduysa).
echo     Tekrar baslatmak icin: baslat.bat ya da bilgisayari yeniden baslatin.
echo.
pause
