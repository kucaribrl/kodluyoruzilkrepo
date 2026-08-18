@echo off
chcp 65001 >nul
title IQ Basics - Otomatik Baslatmayi Kaldir
cd /d "%~dp0"

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LNK=%STARTUP%\IQ Basics Yazici.lnk"

echo.
if exist "%LNK%" (
  del "%LNK%"
  echo [OK] Otomatik baslatma kaldirildi. Artik bilgisayar acildiginda kendiliginden calismayacak.
) else (
  echo [i] Otomatik baslatma zaten kurulu degil.
)

rem --- Su an arka planda calisan gizli ajani da durdur ---
echo.
echo Arka planda calisan yazici ajani durduruluyor...
taskkill /IM node.exe /F >nul 2>&1
if errorlevel 1 (
  echo [i] Calisan ajan bulunamadi ^(zaten kapaliydi^).
) else (
  echo [OK] Gizli ajan durduruldu.
)
echo.
echo Tekrar baslatmak icin: "baslat.bat" ^(gorunur^) ya da "otomatik-baslat-kur.bat" ^(gizli/otomatik^).
echo.
pause
