@echo off
title IQ Basics - Yazici Ajani
cd /d "%~dp0"

if exist "config.json" goto cfgok
echo.
echo [!] config.json bulunamadi.
echo     "config.example.json" dosyasini "config.json" olarak kopyalayip
echo     icini doldur (e-posta / sifre / yazici adi), sonra tekrar calistir.
echo.
pause
exit /b

:cfgok
if exist "node_modules" goto pkgok
echo Ilk kurulum: gerekli paketler indiriliyor... (bir defalik, biraz surebilir)
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
node agent.js
rem cikis kodu 2/3 = yapilandirma hatasi (sifre/QR) -> yeniden denemenin anlami yok
if errorlevel 2 (
  echo.
  echo [!] Ajan durdu: yapilandirma hatasi ^(sifre/QR^). Duzeltip tekrar baslatin.
  pause
  exit /b
)
echo.
echo [i] Ajan durdu. 3 saniye sonra yeniden baslatiliyor... (kapatmak icin bu pencereyi kapat)
timeout /t 3 /nobreak >nul
goto loop
