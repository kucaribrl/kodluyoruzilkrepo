' IQ Basics — Yazici Ajanini GIZLI (penceresiz) baslatir.
' Otomatik baslatma bunu kullanir: acilista hicbir pencere gorunmez,
' ajan arka planda calisir. Durum icin: uygulamada Ayarlar > Otomatik Yazici.
Dim sh, fso, dir
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = dir
' 0 = pencere gizli, False = bekleme. _gizli-loop.bat ajani calisir tutar.
sh.Run "cmd /c """ & dir & "\_gizli-loop.bat""", 0, False
