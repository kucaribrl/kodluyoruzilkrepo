@echo off
title IQ Basics - WhatsApp Ajani Otomatik Baslatma
cd /d "%~dp0"

echo.
echo === IQ Basics - WhatsApp Ajani Otomatik Baslatma ===
echo.
echo Bu islem, bilgisayar her acildiginda WhatsApp ajaninin
echo KENDILIGINDEN ve GIZLI (siyah pencere olmadan) baslamasini saglar.
echo.

if exist "config.json" goto cfgok
echo [!] Once "config.json" dosyasini hazirlamalisin.
echo     "config.example.json" dosyasini "config.json" olarak kopyalayip
echo     icini doldur (bulut e-posta + sifre), sonra bunu tekrar calistir.
echo.
pause
exit /b

:cfgok
if exist "wa-oturum" goto qrok
echo [!] WhatsApp girisi henuz yapilmamis.
echo     Once "baslat.bat" ile calistirip ekrandaki KARE KODU telefona okut
echo     (WhatsApp - Ayarlar - Bagli Cihazlar - Cihaz Bagla).
echo     Giris kaydedilince bu dosyayi tekrar calistir.
echo.
pause
exit /b

:qrok
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
rem --- Internetten inen dosyalardaki guvenlik engelini kaldir ---
rem --- (kaldirilmazsa Windows her acilista "Calistir?" kutusu gosterir, ajan baslamaz) ---
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -Path '%~dp0*' -File | Unblock-File -ErrorAction SilentlyContinue" >nul 2>&1
set "TARGET=%~dp0gizli-baslat.vbs"
set "WORKDIR=%~dp0"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LNK=%STARTUP%\IQ Basics WhatsApp.lnk"

rem --- Baslangic klasorune, GIZLI baslaticiya kisayol olustur ---
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=New-Object -ComObject WScript.Shell; $l=$s.CreateShortcut($env:LNK); $l.TargetPath='wscript.exe'; $l.Arguments='\"'+$env:TARGET+'\"'; $l.WorkingDirectory=$env:WORKDIR; $l.Description='IQ Basics WhatsApp Ajani (gizli)'; $l.Save()"

if not exist "%LNK%" goto kisayolhata

echo [OK] Kuruldu! Artik bilgisayar her acildiginda WhatsApp ajani
echo      GIZLI olarak (pencere gorunmeden) otomatik baslayacak.
echo.
echo      Calisiyor mu diye bakmak icin: uygulama - Ayarlar - WhatsApp Otomasyonu
echo      - Test mesaji kuyruga ekle (mesaj birkac saniyede gelmeli).
echo      Durdurmak icin: durdur.bat   Geri almak icin: otomatik-baslat-kaldir.bat
echo.
choice /c EH /n /m "Ajani simdi de (gizli) baslatayim mi? (E=Evet / H=Hayir): "
if errorlevel 2 goto son

rem --- Once eski/calisan ajan varsa kapat, sonra gizli baslat ---
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | Where-Object { $_.CommandLine -like '*baslat.js*iqwa*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*wa-oturum*' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
start "" wscript.exe "%TARGET%"
echo.
echo Ajan gizli olarak baslatildi (pencere yok).
goto son

:kisayolhata
echo [!] Kisayol olusturulamadi. Bu dosyaya sag tiklayip
echo     "Yonetici olarak calistir" ile tekrar dene.

:son
echo.
pause
