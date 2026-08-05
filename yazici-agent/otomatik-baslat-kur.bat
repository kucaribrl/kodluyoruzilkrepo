@echo off
chcp 65001 >nul
title IQ Basics - Otomatik Baslatma Kurulumu
cd /d "%~dp0"

echo.
echo === IQ Basics · Otomatik Baslatma Kurulumu ===
echo.
echo Bu islem, bilgisayar her acildiginda yazici ajaninin
echo KENDILIGINDEN baslamasini saglar. (Kucuk bir pencere olarak acilir.)
echo.

rem --- config.json var mi? ---
if not exist "config.json" (
  echo [!] Once "config.json" dosyasini hazirlamalisin.
  echo     "config.example.json" dosyasini "config.json" olarak kopyalayip
  echo     icini doldur ^(e-posta / sifre / yazici adi^), sonra bu dosyayi tekrar calistir.
  echo.
  pause
  exit /b
)

set "TARGET=%~dp0baslat.bat"
set "WORKDIR=%~dp0"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LNK=%STARTUP%\IQ Basics Yazici.lnk"

rem --- Baslangic klasorune kisayol olustur (kucultulmus calisir: WindowStyle=7) ---
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=New-Object -ComObject WScript.Shell; $l=$s.CreateShortcut($env:LNK); $l.TargetPath=$env:TARGET; $l.WorkingDirectory=$env:WORKDIR; $l.WindowStyle=7; $l.Description='IQ Basics Yazici Ajani'; $l.Save()"

if exist "%LNK%" (
  echo [OK] Kuruldu! Artik bilgisayar her acildiginda yazici ajani otomatik baslayacak.
  echo.
  echo      Geri almak istersen: "otomatik-baslat-kaldir.bat" dosyasina cift tikla.
  echo.
  choice /c EH /n /m "Ajani simdi de baslatayim mi? (E=Evet / H=Hayir): "
  if errorlevel 2 goto son
  start "" /min "%TARGET%"
  echo Ajan baslatildi ^(gorev cubugunda kucuk pencere^).
) else (
  echo [!] Kisayol olusturulamadi. Yonetici olarak deneyebilir ya da
  echo     BASLA-TR.md dosyasindaki elle yontemi kullanabilirsin.
)

:son
echo.
pause
