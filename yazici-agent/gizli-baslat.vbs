' IQ Basics - Yazici Ajanini GIZLI (penceresiz) calistirir.
' Ajan durursa 3 sn sonra yeniden baslatir.
' GUVENLIK: art arda 5 hizli cokuste ya da sifre hatasinda (cikis kodu 2) DURUR,
' nedenini ajan-hata.log dosyasina yazar. Durdurmak icin: durdur.bat
Dim sh, fso, dir, rc, t0, sayac
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = dir
sayac = 0
Do
  t0 = Timer
  ' 0 = pencere gizli, True = ajan bitene kadar bekle; rc = cikis kodu
  rc = sh.Run("cmd /c node agent.js", 0, True)
  If rc = 2 Then
    HataYaz "Bulut girisi reddedildi (e-posta/sifre yanlis). config.json duzeltilip baslat.bat ile tekrar deneyin."
    Exit Do
  End If
  If Timer - t0 < 20 And Timer - t0 >= 0 Then sayac = sayac + 1 Else sayac = 0
  If sayac >= 5 Then
    HataYaz "Ajan art arda 5 kez hemen kapandi (config/kurulum hatasi olabilir). baslat.bat ile pencereli calistirip hatayi gorun."
    Exit Do
  End If
  WScript.Sleep 3000
Loop
Sub HataYaz(msg)
  On Error Resume Next
  Dim f: Set f = fso.OpenTextFile(dir & "\ajan-hata.log", 8, True)
  f.WriteLine Now & " - " & msg
  f.Close
End Sub
