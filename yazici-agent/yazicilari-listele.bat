@echo off
title IQ Basics - Kurulu Yazicilar
echo.
echo === Bu bilgisayarda KURULU yazicilar (tam adlariyla) ===
echo.
powershell -NoProfile -Command "Add-Type -AssemblyName System.Drawing; [System.Drawing.Printing.PrinterSettings]::InstalledPrinters | ForEach-Object { Write-Host ('   - ' + $_) }"
echo.
echo Not: config.json icindeki 'yaziciAdi' (fis) ve 'etiketYaziciAdi' (barkod)
echo      degerlerini yukaridaki adlardan biriyle BIREBIR ayni yaz.
echo      (Yeni print-image.ps1 adi otomatik esler ama yine de dogru yazmak en iyisi.)
echo.
pause
