# IQ Basics — sessiz görsel baskı (Windows)
# Verilen PNG'yi, yazıcının tam basılabilir genişliğine sığdırarak sessizce basar.
param(
  [Parameter(Mandatory=$true)][string]$img,
  [string]$printer = "",
  [int]$copies = 1
)
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"

# Kurulu yazıcı adlarını getir
function Get-Printers { return @([System.Drawing.Printing.PrinterSettings]::InstalledPrinters) }
function Norm([string]$x) { return ($x -replace '[^A-Za-z0-9]', '').ToLower() }

# config'teki adı, Windows'taki GERÇEK yazıcı adıyla esnek eşle:
# 1) birebir (harf duyarsız) 2) içeren/içerilen 3) boşluk/tire/harf farkını yok sayarak
function Resolve-PrinterName([string]$want) {
  if ([string]::IsNullOrWhiteSpace($want)) { return "" }  # boş -> Windows varsayılan yazıcısı
  $want = $want.Trim()
  $all = Get-Printers
  foreach ($p in $all) { if ($p -ieq $want) { return $p } }
  foreach ($p in $all) { $pl=$p.ToLower(); $wl=$want.ToLower(); if ($pl.Contains($wl) -or $wl.Contains($pl)) { return $p } }
  $wn = Norm $want
  foreach ($p in $all) { if ((Norm $p) -eq $wn) { return $p } }
  foreach ($p in $all) { $pn = Norm $p; if ($pn.Contains($wn) -or $wn.Contains($pn)) { return $p } }
  return $null
}

$resolved = Resolve-PrinterName $printer
if ($null -eq $resolved) {
  $list = (Get-Printers) -join "`n   - "
  throw "Yazici bulunamadi: '$printer'. Kurulu yazicilar:`n   - $list`n(config.json icindeki 'yaziciAdi'/'etiketYaziciAdi' degerini bunlardan biriyle BIREBIR ayni yaz.)"
}

$image = [System.Drawing.Image]::FromFile($img)
try {
  for ($ci = 0; $ci -lt $copies; $ci++) {
    $pd = New-Object System.Drawing.Printing.PrintDocument
    if ($resolved -ne "") { $pd.PrinterSettings.PrinterName = $resolved }
    if (-not $pd.PrinterSettings.IsValid) {
      $list = (Get-Printers) -join "`n   - "
      throw "Yaziciya erisilemiyor: '$resolved' (ayarlar gecerli degil / surucu sorunu). Kurulu yazicilar:`n   - $list"
    }
    $pd.DocumentName = "IQ Basics Fis"
    try { $pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0) } catch {}
    $pd.add_PrintPage({
      param($s, $e)
      # Sayfa genişliğine (tam basılabilir alan) orantılı sığdır
      $pw = $e.PageBounds.Width
      $scale = $pw / $image.Width
      $w = [int]($image.Width * $scale)
      $h = [int]($image.Height * $scale)
      $e.Graphics.DrawImage($image, 0, 0, $w, $h)
      $e.HasMorePages = $false
    })
    $pd.Print()
  }
}
finally {
  $image.Dispose()
}
