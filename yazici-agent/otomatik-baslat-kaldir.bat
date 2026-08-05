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
  echo      ^(Istedigin zaman "baslat.bat" ile elle acabilirsin.^)
) else (
  echo [i] Zaten kurulu degil ^(otomatik baslatma kisayolu bulunamadi^).
)
echo.
pause
