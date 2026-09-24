$ErrorActionPreference = 'Continue'
$OutDir = 'C:\Users\nadire\Desktop\nadire-portfolio\assets\staj-cpp'
$exe = 'C:\Users\nadire\Desktop\StajProje_CPP\build-mingw\StajProje_CPP.exe'
$stl = 'C:\Users\nadire\Desktop\StajProje_CPP\samples\cube.stl'
$csvOut = Join-Path $OutDir 'section-export.csv'
$reqGrab = Join-Path $env:TEMP 'staj_portfolio_grab.txt'
$reqCmd = Join-Path $env:TEMP 'staj_portfolio_cmd.txt'
$doneCmd = Join-Path $env:TEMP 'staj_portfolio_cmd.done'
$env:PATH = "C:\Qt\Tools\mingw1310_64\bin;C:\Qt\6.9.0\mingw_64\bin;" + $env:PATH
$env:PORTFOLIO_CAPTURE = '1'
$env:QT_SCALE_FACTOR = '1'
$env:QT_AUTO_SCREEN_SCALE_FACTOR = '0'
$env:QT_ENABLE_HIGHDPI_SCALING = '0'

function Kill-App {
  Get-Process StajProje_CPP -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 700
}
function Wait-App {
  for ($i=0; $i -lt 25; $i++) {
    Start-Sleep 1
    $p = Get-Process StajProje_CPP -EA SilentlyContinue | Where-Object MainWindowHandle -ne 0 | Select-Object -First 1
    if ($p) { return $p }
  }
  return $null
}
function Qt-Cmd([string]$line) {
  Remove-Item $doneCmd -EA SilentlyContinue
  Remove-Item $reqCmd -EA SilentlyContinue
  Set-Content -Path $reqCmd -Value $line -Encoding ascii -NoNewline
  for ($i=0; $i -lt 50; $i++) {
    Start-Sleep -Milliseconds 120
    if (Test-Path $doneCmd) { break }
  }
  Remove-Item $doneCmd -EA SilentlyContinue
  Write-Output "cmd: $line"
  Start-Sleep -Milliseconds 400
}
function Qt-Grab([string]$path) {
  Remove-Item $path -EA SilentlyContinue
  Remove-Item "$path.done" -EA SilentlyContinue
  Remove-Item $reqGrab -EA SilentlyContinue
  Set-Content -Path $reqGrab -Value $path -Encoding ascii -NoNewline
  for ($i=0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 250
    if (Test-Path "$path.done") { break }
    if ((Test-Path $path) -and ((Get-Item $path).Length -gt 1000)) { break }
  }
  Remove-Item "$path.done" -EA SilentlyContinue
  if (Test-Path $path) {
    Write-Output "grab $([IO.Path]::GetFileName($path)) $((Get-Item $path).Length)"
  } else {
    Write-Output "FAIL grab $path"
  }
}
function Render-CsvPng([string]$csvPath, [string]$pngPath, [string]$axis, [string]$pointText) {
  Add-Type -AssemblyName System.Drawing
  $lines = Get-Content $csvPath -ErrorAction Stop
  $bmp = New-Object System.Drawing.Bitmap 1280, 780
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(248, 249, 251))
  $titleFont = New-Object System.Drawing.Font 'Consolas', 18, ([System.Drawing.FontStyle]::Bold)
  $subFont = New-Object System.Drawing.Font 'Consolas', 13, ([System.Drawing.FontStyle]::Bold)
  $mono = New-Object System.Drawing.Font 'Consolas', 14
  $small = New-Object System.Drawing.Font 'Consolas', 12
  $brush = [System.Drawing.Brushes]::Black
  $muted = [System.Drawing.Brushes]::DimGray
  $accent = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(37, 99, 235))
  $g.FillRectangle($accent, 0, 0, 1280, 56)
  $axisUp = $axis.ToUpper()
  $g.DrawString("Export CSV — $axisUp kesiti koordinatlari", $titleFont, [System.Drawing.Brushes]::White, 24, 14)
  $g.DrawString("Dosya: $([IO.Path]::GetFileName($csvPath))", $mono, $muted, 24, 72)
  $g.DrawString("Kesit ekseni: $axisUp   |   Apply Point: $pointText   |   Space: Normalize", $subFont, $brush, 24, 102)
  $hint = switch ($axisUp) {
    'X' { 'Aciklama: X sabit duzlem (YZ kesiti). Satirlardaki x degeri noktanin x degerine yakin.' }
    'Y' { 'Aciklama: Y sabit duzlem (XZ kesiti). Satirlardaki y degeri noktanin y degerine yakin.' }
    'Z' { 'Aciklama: Z sabit duzlem (XY kesiti). Satirlardaki z degeri noktanin z degerine yakin.' }
    default { 'Aciklama: Secilen eksene dik kesit poligonunun x,y,z noktalari.' }
  }
  $g.DrawString($hint, $small, $muted, 24, 128)
  $y = 168
  $g.DrawString('--- CSV icerik ---', $subFont, $brush, 24, $y)
  $y += 32
  foreach ($line in $lines) {
    if ($y -gt 740) { break }
    $g.DrawString($line, $mono, $brush, 24, $y)
    $y += 26
  }
  $g.Dispose()
  $bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "csv-png $([IO.Path]::GetFileName($pngPath))"
}

Kill-App
# 01 empty
$grab01 = Join-Path $OutDir '01-empty.png'
Start-Process -FilePath $exe -ArgumentList @("--grab=$grab01") -Wait -NoNewWindow
Write-Output "01 $((Get-Item $grab01).Length)"

Kill-App
# Interactive session with model
Start-Process -FilePath $exe -ArgumentList @($stl)
if (-not (Wait-App)) { Write-Output 'FAIL start'; exit 1 }
Start-Sleep 2

# 02 model loaded (default camera)
Qt-Grab (Join-Path $OutDir '02-model-loaded.png')

# 03 point: all three XYZ filled
Qt-Cmd 'VIEW default'
Qt-Cmd 'ALPHA 0.28'
Qt-Cmd 'SET_POINT 0.25 -0.15 0.10'
Qt-Cmd 'APPLY'
Qt-Grab (Join-Path $OutDir '03-point-applied.png')

# 04 X section — all XYZ filled, axis=x, orange cut visible in 3D
Qt-Cmd 'VIEW default'
Qt-Cmd 'ORBIT 0.75 0.40'
Qt-Cmd 'ALPHA 0.22'
Qt-Cmd 'SET_POINT 0.20 0.15 -0.10'
Qt-Cmd 'APPLY'
Qt-Cmd 'AXIS x'
Qt-Cmd 'SECTION'
Start-Sleep -Milliseconds 700
Qt-Grab (Join-Path $OutDir '04-section-x.png')

# 05 Y section — all XYZ filled, axis=y
Qt-Cmd 'ORBIT -0.55 0.55'
Qt-Cmd 'SET_POINT 0.12 -0.25 0.18'
Qt-Cmd 'APPLY'
Qt-Cmd 'AXIS y'
Qt-Cmd 'SECTION'
Start-Sleep -Milliseconds 700
Qt-Grab (Join-Path $OutDir '05-section-y.png')

# 06 Z section — all XYZ filled, axis=z
Qt-Cmd 'ORBIT 0.35 0.25'
Qt-Cmd 'SET_POINT -0.15 0.20 0.30'
Qt-Cmd 'APPLY'
Qt-Cmd 'AXIS z'
Qt-Cmd 'SECTION'
Start-Sleep -Milliseconds 700
Qt-Grab (Join-Path $OutDir '06-section-z.png')

# 07 transparency with section still visible
Qt-Cmd 'ALPHA 0.12'
Qt-Grab (Join-Path $OutDir '07-transparency.png')

# 08 Export CSV — in-app banner only (never full desktop / other apps)
# Export follows the last Take Section = Z axis, point (-0.15, 0.20, 0.30)
Remove-Item $csvOut -EA SilentlyContinue
Qt-Cmd ("EXPORT $csvOut")
Start-Sleep -Milliseconds 500
Qt-Grab (Join-Path $OutDir '08-export-csv.png')
Qt-Cmd 'DISMISS'

# 09 CSV file content preview — labeled as Z section
if (Test-Path $csvOut) {
  Render-CsvPng $csvOut (Join-Path $OutDir '09-csv-content.png') 'Z' '(-0.15, 0.20, 0.30)'
  Get-Content $csvOut | Select-Object -First 12
} else {
  Write-Output 'FAIL csv missing'
}

Kill-App

# Hash check: X/Y/Z must differ
Add-Type -AssemblyName System.Drawing
$hashes = @{}
foreach ($f in @('04-section-x.png','05-section-y.png','06-section-z.png','03-point-applied.png','08-export-csv.png','09-csv-content.png')) {
  $p = Join-Path $OutDir $f
  if (-not (Test-Path $p)) { Write-Output "MISSING $f"; continue }
  $h = (Get-FileHash $p -Algorithm MD5).Hash
  $img = [System.Drawing.Bitmap]::FromFile($p)
  $c = $img.GetPixel(100,0)
  Write-Output "$f $($img.Width)x$($img.Height) md5=$($h.Substring(0,8)) top=$($c.R),$($c.G),$($c.B) len=$((Get-Item $p).Length)"
  $img.Dispose()
  $hashes[$f] = $h
}
if ($hashes['04-section-x.png'] -eq $hashes['05-section-y.png']) { Write-Output 'WARN x==y' }
if ($hashes['05-section-y.png'] -eq $hashes['06-section-z.png']) { Write-Output 'WARN y==z' }
if ($hashes['04-section-x.png'] -eq $hashes['06-section-z.png']) { Write-Output 'WARN x==z' }
if ($hashes['04-section-x.png'] -ne $hashes['05-section-y.png'] -and $hashes['05-section-y.png'] -ne $hashes['06-section-z.png']) {
  Write-Output 'OK sections are distinct'
}
