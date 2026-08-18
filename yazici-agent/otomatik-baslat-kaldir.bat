@echo off
title IQ Basics - Otomatik Baslatmayi Kaldir
cd /d "%~dp0"

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LNK=%STARTUP%\IQ Basics Yazici.lnk"

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
echo Arka planda calisan yazici ajani durduruluyor...
taskkill /IM node.exe /F >nul 2>&1
if errorlevel 1 echo [i] Calisan ajan bulunamadi (zaten kapaliydi).
if not errorlevel 1 echo [OK] Gizli ajan durduruldu.
echo.
echo Tekrar baslatmak icin: baslat.bat (gorunur)
echo veya otomatik-baslat-kur.bat (gizli / her acilista otomatik).
echo.
pause
