@echo off
cd /d "%~dp0"
rem GIZLI dongu - gizli-baslat.vbs bunu penceresiz calistirir.
rem Pause YOK (gorunmez oldugu icin takilmasin). Ajan durursa 3 sn'de yeniden baslar.
:loop
node agent.js
timeout /t 3 /nobreak >nul
goto loop
