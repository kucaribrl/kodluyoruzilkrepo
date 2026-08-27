@echo off
title IQ Basics - WhatsApp Ajani
cd /d "%~dp0"

if exist "config.json" goto cfgok
echo.
echo [!] config.json bulunamadi.
echo     "config.example.json" dosyasini "config.json" olarak kopyalayip
echo     icini doldur (bulut e-posta + sifre), sonra tekrar calistir.
echo.
pause
exit /b

:cfgok
if exist "node_modules" goto pkgok
echo Ilk kurulum: gerekli paketler indiriliyor... (bir defalik, 2-5 dakika surebilir)
call npm install
if errorlevel 1 goto npmhata
goto pkgok

:npmhata
echo.
echo [!] npm install basarisiz. Node.js kurulu mu? nodejs.org adresinden LTS surumunu kur.
echo.
pause
exit /b

:pkgok
:loop
node baslat.js
echo.
echo [i] Ajan durdu. 3 saniye sonra yeniden baslatiliyor... (kapatmak icin pencereyi kapat)
timeout /t 3 /nobreak >nul
goto loop
