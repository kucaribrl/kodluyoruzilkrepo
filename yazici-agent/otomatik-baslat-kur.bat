@echo off
title IQ Basics - Otomatik Baslatma Kurulumu
cd /d "%~dp0"

echo.
echo === IQ Basics - Otomatik Baslatma Kurulumu ===
echo.
echo Bu islem, bilgisayar her acildiginda yazici ajaninin
echo KENDILIGINDEN ve GIZLI (hicbir pencere gorunmeden) baslamasini saglar.
echo.

if exist "config.json" goto cfgok
echo [!] Once "config.json" dosyasini hazirlamalisin.
echo     "config.example.json" dosyasini "config.json" olarak kopyalayip
echo     icini doldur (e-posta / sifre / yazici adi), sonra bu dosyayi tekrar calistir.
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
echo [!] npm install basarisiz. Node.js kurulu mu? nodejs.org - LTS surumunu kur.
echo.
pause
exit /b

:pkgok
set "TARGET=%~dp0gizli-baslat.vbs"
set "WORKDIR=%~dp0"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LNK=%STARTUP%\IQ Basics Yazici.lnk"

rem --- Baslangic klasorune, GIZLI baslaticiya kisayol olustur ---
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=New-Object -ComObject WScript.Shell; $l=$s.CreateShortcut($env:LNK); $l.TargetPath=$env:TARGET; $l.WorkingDirectory=$env:WORKDIR; $l.Description='IQ Basics Yazici Ajani (gizli)'; $l.Save()"

if not exist "%LNK%" goto kisayolhata

echo [OK] Kuruldu! Artik bilgisayar her acildiginda yazici ajani
echo      GIZLI olarak (pencere gorunmeden) otomatik baslayacak.
echo.
echo      Calisiyor mu diye bakmak icin: uygulama - Ayarlar - Otomatik Yazici
echo      (durum satirinda "Ajan BAGLI" yazmali).
echo      Durdurmak icin: durdur.bat   Geri almak icin: otomatik-baslat-kaldir.bat
echo.
choice /c EH /n /m "Ajani simdi de (gizli) baslatayim mi? (E=Evet / H=Hayir): "
if errorlevel 2 goto son

rem --- Once eski/calisan ajan varsa kapat, sonra gizli baslat ---
taskkill /IM node.exe /F >nul 2>&1
start "" wscript.exe "%TARGET%"
echo.
echo Ajan gizli olarak baslatildi (pencere yok).
goto son

:kisayolhata
echo [!] Kisayol olusturulamadi. Bu dosyaya sag tiklayip
echo     "Yonetici olarak calistir" ile tekrar dene.
echo     (Ya da BASLA-TR.md icindeki elle yontem.)

:son
echo.
pause
