@echo off
chcp 65001 >nul
title IQ Basics - Otomatik Baslatma Kurulumu
cd /d "%~dp0"

echo.
echo === IQ Basics - Otomatik Baslatma Kurulumu ===
echo.
echo Bu islem, bilgisayar her acildiginda yazici ajaninin
echo KENDILIGINDEN ve GIZLI (hicbir pencere gorunmeden) baslamasini saglar.
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

rem --- Gerekli paketler bir kez kurulsun (GORUNUR) ki gizli calisirken takilmasin ---
if not exist "node_modules" (
  echo Ilk kurulum: gerekli paketler indiriliyor... ^(bir defalik, biraz surebilir^)
  call npm install
  if errorlevel 1 (
    echo.
    echo [!] npm install basarisiz. Node.js kurulu mu? nodejs.org - LTS surumunu kur.
    pause
    exit /b
  )
)

set "TARGET=%~dp0gizli-baslat.vbs"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LNK=%STARTUP%\IQ Basics Yazici.lnk"

rem --- Baslangic klasorune, GIZLI baslaticiya kisayol olustur ---
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=New-Object -ComObject WScript.Shell; $l=$s.CreateShortcut($env:LNK); $l.TargetPath=$env:TARGET; $l.WorkingDirectory=(Split-Path $env:TARGET); $l.Description='IQ Basics Yazici Ajani (gizli)'; $l.Save()"

if exist "%LNK%" (
  echo [OK] Kuruldu! Artik bilgisayar her acildiginda yazici ajani
  echo      GIZLI olarak ^(pencere gorunmeden^) otomatik baslayacak.
  echo.
  echo      Calisiyor mu diye bakmak icin: uygulama - Ayarlar - Otomatik Yazici.
  echo      Geri almak icin: "otomatik-baslat-kaldir.bat" dosyasina cift tikla.
  echo.
  choice /c EH /n /m "Ajani simdi de ^(gizli^) baslatayim mi? (E=Evet / H=Hayir): "
  if errorlevel 2 goto son
  start "" wscript.exe "%TARGET%"
  echo Ajan gizli olarak baslatildi ^(pencere yok^). Uygulamadan "Ajan BAGLI" oldugunu gorebilirsin.
) else (
  echo [!] Kisayol olusturulamadi. Yonetici olarak deneyebilir ya da
  echo     BASLA-TR.md dosyasindaki elle yontemi kullanabilirsin.
)

:son
echo.
pause
