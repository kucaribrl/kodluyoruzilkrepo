# IQ Basics - Yazici Ajani: GIZLI otomatik baslatma kurulumu (PowerShell)
# Kullanim: yazici-agent klasorunde adres cubugua powershell yazip Enter,
# sonra:  .\kur-gizli.ps1     (ya da tum satirlari kopyalayip yapistir)
$d = (Get-Location).Path
# Internetten inen dosyalarin guvenlik engelini kaldir (acilista 'Calistir?' kutusunu onler)
Get-ChildItem -Path (Join-Path $d '*') -File | Unblock-File -ErrorAction SilentlyContinue
$vbsPath = Join-Path $d 'gizli-baslat.vbs'
$vbs = @'
Dim sh, fso, dir
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = dir
Do
  sh.Run "cmd /c node agent.js", 0, True
  WScript.Sleep 3000
Loop
'@
Set-Content -Path $vbsPath -Value $vbs -Encoding ASCII
$startup = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$s = New-Object -ComObject WScript.Shell
$l = $s.CreateShortcut((Join-Path $startup 'IQ Basics Yazici.lnk'))
$l.TargetPath = 'wscript.exe'
$l.Arguments = '"' + $vbsPath + '"'
$l.WorkingDirectory = $d
$l.Save()
Get-CimInstance Win32_Process -Filter "name='node.exe'" | Where-Object { $_.CommandLine -like '*agent.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force } 2>$null
Start-Process wscript.exe -ArgumentList ('"' + $vbsPath + '"')
Write-Host ''
Write-Host 'TAMAM - Ajan GIZLI calisiyor (pencere yok).' -ForegroundColor Green
Write-Host 'Bilgisayar her acildiginda otomatik baslayacak.' -ForegroundColor Green
Write-Host 'Kontrol: uygulama > Ayarlar > Otomatik Yazici > Ajan BAGLI yazmali.'
