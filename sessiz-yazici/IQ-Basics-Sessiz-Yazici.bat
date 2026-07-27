@echo off
chcp 65001 >nul
title IQ Basics - Sessiz Yazici Modu (MC gibi - ekransiz baski)

rem === Uygulama adresi ===
set "URL=https://kucaribrl.github.io/kodluyoruzilkrepo/"

rem === Chrome'u bul ===
set "CHROME="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if "%CHROME%"=="" (
  echo.
  echo [!] Google Chrome bulunamadi.
  echo     Once Chrome kur: https://www.google.com/chrome
  echo.
  pause
  exit /b
)

echo.
echo  IQ Basics sessiz baski modunda aciliyor...
echo  Artik "Yazdir" deyince EKRAN CIKMAZ, direkt yaziciya basar (MC gibi).
echo.
echo  Not: Windows'ta yaziciyi VARSAYILAN yap ve kagit boyutunu etikete/fise ayarla.
echo.

rem --kiosk-printing: yazdirma ekrani cikmadan varsayilan yaziciya basar
rem ayri profil: bu mod her zaman acik kalsin diye
start "" "%CHROME%" --kiosk-printing --user-data-dir="%LocalAppData%\IQBasicsYazici" --new-window "%URL%"

exit /b
