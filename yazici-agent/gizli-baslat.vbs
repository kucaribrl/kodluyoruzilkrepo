' IQ Basics - Yazici Ajanini GIZLI (penceresiz) calistirir.
' Kendi kendine yeter: ajan durursa 3 sn sonra yeniden baslatir.
' Durdurmak icin: durdur.bat (ya da Gorev Yoneticisi > wscript.exe / node.exe)
Dim sh, fso, dir
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = dir
Do
  ' 0 = pencere gizli, True = ajan bitene kadar bekle
  sh.Run "cmd /c node agent.js", 0, True
  WScript.Sleep 3000
Loop
