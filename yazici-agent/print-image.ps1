# IQ Basics — sessiz görsel baskı (Windows)
# Verilen PNG'yi, yazıcının tam basılabilir genişliğine sığdırarak sessizce basar.
param(
  [Parameter(Mandatory=$true)][string]$img,
  [string]$printer = "",
  [int]$copies = 1
)
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"

$image = [System.Drawing.Image]::FromFile($img)
try {
  for ($ci = 0; $ci -lt $copies; $ci++) {
    $pd = New-Object System.Drawing.Printing.PrintDocument
    if ($printer -ne "") { $pd.PrinterSettings.PrinterName = $printer }
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
