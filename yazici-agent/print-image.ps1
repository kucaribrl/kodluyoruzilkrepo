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
  $wn = Norm $want
  foreach ($p in $all) { if ((Norm $p) -eq $wn) { return $p } }
  # esnek eşleme yalnız TEK yönlü: istenen ad gerçek adın İÇİNDE geçmeli (ters yön yanlış yazıcıya basardı)
  # çok kısa ad (<3 karakter) her şeyle eşleşir → reddet
  if ($wn.Length -lt 3) { return $null }
  $wl = $want.ToLower()
  $adaylar = @($all | Where-Object { $_.ToLower().Contains($wl) -or (Norm $_).Contains($wn) })
  if ($adaylar.Count -gt 1) {
    $list = $adaylar -join "`n   - "
    [Console]::Error.WriteLine("Yazici adi belirsiz: '$want' birden fazla yaziciyla eslesiyor:`n   - $list`n(config.json icindeki adi bunlardan biriyle BIREBIR ayni yaz.)")
    exit 1
  }
  if ($adaylar.Count -eq 1) { return $adaylar[0] }
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
      # DOT-FOR-DOT: 1 görsel piksel = 1 yazıcı noktası → keskin (bulanık değil).
      # Görsel yazıcının doğal genişliğinde (~576 nokta) hazırlanır; ölçekleme yapılmaz.
      $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
      $e.Graphics.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
      $e.Graphics.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::None
      $e.Graphics.PageUnit          = [System.Drawing.GraphicsUnit]::Pixel
      $dpi = $e.Graphics.DpiX; if ($dpi -lt 50) { $dpi = 203 }
      $pwDots = [int]([double]$e.PageBounds.Width / 100.0 * $dpi)   # sayfa genişliği (nokta)
      if ($pwDots -lt 100) { $pwDots = 576 }
      if ($image.Width -le $pwDots) {
        # sığıyor → birebir (dot-for-dot), en keskin
        $e.Graphics.DrawImage($image, 0, 0, $image.Width, $image.Height)
      } else {
        # taşıyorsa yalnızca genişliğe indir (NearestNeighbor ile keskin kalır)
        $dw = $pwDots; $dh = [int]([double]$image.Height * $pwDots / $image.Width)
        $e.Graphics.DrawImage($image, 0, 0, $dw, $dh)
      }
      $e.HasMorePages = $false
    })
    $pd.Print()
  }
}
finally {
  $image.Dispose()
}
