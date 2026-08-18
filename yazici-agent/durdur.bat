@echo off
chcp 65001 >nul
title IQ Basics - Yazici Ajanini Durdur
cd /d "%~dp0"
echo.
echo Arka planda calisan yazici ajani durduruluyor...
taskkill /IM node.exe /F >nul 2>&1
if errorlevel 1 (
  echo [i] Calisan ajan bulunamadi ^(zaten kapaliydi^).
) else (
  echo [OK] Ajan durduruldu. ^(Tekrar baslatmak icin baslat.bat ya da bilgisayari yeniden baslat.^)
)
echo.
pause
