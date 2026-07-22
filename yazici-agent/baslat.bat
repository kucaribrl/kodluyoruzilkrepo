@echo off
chcp 65001 >nul
title IQ Basics - Yazici Ajani
cd /d "%~dp0"

if not exist "config.json" (
  echo.
  echo [!] config.json bulunamadi.
  echo     "config.example.json" dosyasini "config.json" olarak kopyalayip
  echo     icini doldur ^(e-posta / sifre / yazici adi^), sonra tekrar calistir.
  echo.
  pause
  exit /b
)

if not exist "node_modules" (
  echo Ilk kurulum: gerekli paketler indiriliyor... ^(bir defalik, biraz surebilir^)
  call npm install
  if errorlevel 1 (
    echo.
    echo [!] npm install basarisiz. Node.js kurulu mu? nodejs.org adresinden LTS surumunu kur.
    pause
    exit /b
  )
)

:loop
node agent.js
echo.
echo [i] Ajan durdu. 3 saniye sonra yeniden baslatiliyor... ^(kapatmak icin bu pencereyi kapat^)
timeout /t 3 /nobreak >nul
goto loop
