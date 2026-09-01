' IQ Basics - WhatsApp Ajanini GIZLI (penceresiz) calistirir.
' Ajan durursa 3 sn sonra yeniden baslatir.
' GUVENLIK: art arda 5 hizli cokuste, sifre hatasinda (cikis 2) ya da
' WhatsApp oturumu dustugunde (cikis 3 - QR gerekir) DURUR,
' nedenini ajan-hata.log dosyasina yazar. Durdurmak icin: durdur.bat
Dim sh, fso, dir, rc, t0, sayac
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = dir
' QR daha hic okutulmadiysa gizli baslamanin anlami yok - once baslat.bat
If Not fso.FolderExists(dir & "\wa-oturum") Then
  HataYaz "WhatsApp girisi henuz yapilmamis. Once baslat.bat ile acip QR kodu telefona okutun, sonra gizli mod calisir."
  WScript.Quit
End If
sayac = 0
Do
  t0 = Timer
  ' 0 = pencere gizli, True = ajan bitene kadar bekle; rc = cikis kodu
  rc = sh.Run("cmd /c node baslat.js iqwa gizli", 0, True)
  If rc = 2 Then
    HataYaz "Bulut girisi reddedildi (config.json e-posta/sifre yanlis). Duzeltip baslat.bat ile deneyin."
    Exit Do
  End If
  If rc = 3 Then
    HataYaz "WhatsApp oturumu dusmus - QR yeniden okutulmali. baslat.bat ile acip kareyi telefona okutun."
    Exit Do
  End If
  If Timer - t0 < 20 And Timer - t0 >= 0 Then sayac = sayac + 1 Else sayac = 0
  If sayac >= 5 Then
    HataYaz "Ajan art arda 5 kez hemen kapandi (kurulum hatasi olabilir). baslat.bat ile pencereli calistirip hatayi gorun."
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
