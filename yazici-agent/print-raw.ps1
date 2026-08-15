# IQ Basics — HAM (RAW) ESC/POS baskı (Windows)
# Verilen dosyadaki ham baytları yazıcıya DOĞRUDAN gönderir (sürücü ölçekleme/dither YOK).
# → yazıcının doğal çözünürlüğünde, nokta-nokta net baskı (eski sistem gibi).
param(
  [Parameter(Mandatory=$true)][string]$file,
  [string]$printer = "",
  [int]$copies = 1
)
$ErrorActionPreference = "Stop"

function Get-Printers {
  Add-Type -AssemblyName System.Drawing
  return @([System.Drawing.Printing.PrinterSettings]::InstalledPrinters)
}
function Norm([string]$x) { return ($x -replace '[^A-Za-z0-9]', '').ToLower() }

# config'teki adı gerçek yazıcı adıyla esnek eşle (print-image.ps1 ile aynı mantık)
function Resolve-PrinterName([string]$want) {
  if ([string]::IsNullOrWhiteSpace($want)) {
    # boş → Windows varsayılan yazıcısı
    $pd = New-Object System.Drawing.Printing.PrintDocument
    return $pd.PrinterSettings.PrinterName
  }
  $want = $want.Trim()
  $all = Get-Printers
  foreach ($p in $all) { if ($p -ieq $want) { return $p } }
  foreach ($p in $all) { $pl=$p.ToLower(); $wl=$want.ToLower(); if ($pl.Contains($wl) -or $wl.Contains($pl)) { return $p } }
  $wn = Norm $want
  foreach ($p in $all) { if ((Norm $p) -eq $wn) { return $p } }
  foreach ($p in $all) { $pn = Norm $p; if ($pn.Contains($wn) -or $wn.Contains($pn)) { return $p } }
  return $null
}

# winspool.drv üzerinden RAW veri gönderimi (Microsoft KB322091)
Add-Type @'
using System;
using System.IO;
using System.Runtime.InteropServices;
public class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DOCINFO { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName; [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPWStr)] public string pDataType; }
  [DllImport("winspool.Drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)] public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)] public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFO di);
  [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)] public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

  public static void Send(string printerName, byte[] bytes) {
    IntPtr hPrinter;
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
      throw new Exception("Yazici acilamadi: '" + printerName + "' (hata " + Marshal.GetLastWin32Error() + ")");
    try {
      DOCINFO di = new DOCINFO(); di.pDocName = "IQ Basics Fis"; di.pDataType = "RAW";
      if (!StartDocPrinter(hPrinter, 1, di)) throw new Exception("StartDocPrinter hatasi " + Marshal.GetLastWin32Error());
      try {
        if (!StartPagePrinter(hPrinter)) throw new Exception("StartPagePrinter hatasi " + Marshal.GetLastWin32Error());
        IntPtr p = Marshal.AllocCoTaskMem(bytes.Length);
        try {
          Marshal.Copy(bytes, 0, p, bytes.Length);
          int written;
          if (!WritePrinter(hPrinter, p, bytes.Length, out written))
            throw new Exception("WritePrinter hatasi " + Marshal.GetLastWin32Error());
        } finally { Marshal.FreeCoTaskMem(p); EndPagePrinter(hPrinter); }
      } finally { EndDocPrinter(hPrinter); }
    } finally { ClosePrinter(hPrinter); }
  }
}
'@

$resolved = Resolve-PrinterName $printer
if ($null -eq $resolved) {
  $list = (Get-Printers) -join "`n   - "
  throw "Yazici bulunamadi: '$printer'. Kurulu yazicilar:`n   - $list`n(config.json icindeki 'yaziciAdi' degerini bunlardan biriyle BIREBIR ayni yaz.)"
}

$bytes = [System.IO.File]::ReadAllBytes($file)
for ($ci = 0; $ci -lt $copies; $ci++) {
  [RawPrinter]::Send($resolved, $bytes)
}
