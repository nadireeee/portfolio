$ErrorActionPreference = 'Continue'
$OutDir = 'C:\Users\nadire\Desktop\nadire-portfolio\assets\maui-dotnet'
$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) {
  $chrome = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
}

Add-Type -AssemblyName System.Drawing, System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class CapApp {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, int flags);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, UIntPtr e);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int n);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
}
"@

function Kill-Prof([string]$marker) {
  Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*$marker*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Capture-Win([IntPtr]$hwnd, [string]$path) {
  [void][CapApp]::SetForegroundWindow($hwnd)
  Start-Sleep -Milliseconds 500
  $r = New-Object CapApp+RECT
  [void][CapApp]::GetWindowRect($hwnd, [ref]$r)
  $w = [Math]::Max(200, $r.R - $r.L)
  $h = [Math]::Max(200, $r.B - $r.T)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $hdc = $g.GetHdc()
  $ok = [CapApp]::PrintWindow($hwnd, $hdc, 2)
  $g.ReleaseHdc($hdc)
  if (-not $ok) {
    $g.CopyFromScreen($r.L, $r.T, 0, 0, (New-Object System.Drawing.Size($w, $h)))
  }
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "saved $path ($w x $h) $((Get-Item $path).Length)"
}

function Wait-Title([string]$pat, [int]$sec = 25) {
  for ($i = 0; $i -lt $sec; $i++) {
    Start-Sleep -Seconds 1
    $p = Get-Process chrome -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -match $pat } |
      Sort-Object StartTime -Descending | Select-Object -First 1
    if ($p) { return $p }
  }
  return $null
}

# --- TRAILER: Chrome app mode (no tabs) + fullscreen ---
$marker1 = 'maui-app-yt-' + (Get-Random)
$prof1 = Join-Path $env:TEMP $marker1
New-Item -ItemType Directory -Force -Path $prof1 | Out-Null
$yt = 'https://www.youtube.com/watch?v=6hB3S9bIaco'
Start-Process $chrome -ArgumentList @(
  "--user-data-dir=`"$prof1`"",
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  "--app=$yt",
  '--start-maximized'
)

$p = Wait-Title 'YouTube|Shawshank|Esaret'
if (-not $p) { $p = Get-Process chrome | Where-Object MainWindowHandle -ne 0 | Sort-Object StartTime -Descending | Select-Object -First 1 }
$hwnd = [IntPtr]$p.MainWindowHandle
[void][CapApp]::ShowWindow($hwnd, 3)
[void][CapApp]::SetForegroundWindow($hwnd)
Start-Sleep -Seconds 7

# Click center to focus player, then fullscreen
$r = New-Object CapApp+RECT
[void][CapApp]::GetWindowRect($hwnd, [ref]$r)
$cx = $r.L + [int](($r.R - $r.L) * 0.40)
$cy = $r.T + [int](($r.B - $r.T) * 0.45)
[void][CapApp]::SetCursorPos($cx, $cy)
[CapApp]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
[CapApp]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 400
[System.Windows.Forms.SendKeys]::SendWait('f')
Start-Sleep -Seconds 4

Capture-Win $hwnd (Join-Path $OutDir '14-trailer-youtube.png')
Kill-Prof $marker1
Start-Sleep -Seconds 2

# --- HOMEPAGE: Chrome app mode ---
$marker2 = 'maui-app-wb-' + (Get-Random)
$prof2 = Join-Path $env:TEMP $marker2
New-Item -ItemType Directory -Force -Path $prof2 | Out-Null
$wb = 'https://www.warnerbros.com/movies/shawshank-redemption'
Start-Process $chrome -ArgumentList @(
  "--user-data-dir=`"$prof2`"",
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  "--app=$wb",
  '--start-maximized'
)

$p2 = Wait-Title 'Warner|Shawshank'
if (-not $p2) { $p2 = Get-Process chrome | Where-Object MainWindowHandle -ne 0 | Sort-Object StartTime -Descending | Select-Object -First 1 }
$hwnd2 = [IntPtr]$p2.MainWindowHandle
[void][CapApp]::ShowWindow($hwnd2, 3)
[void][CapApp]::SetForegroundWindow($hwnd2)
Start-Sleep -Seconds 7

# Click AGREE using physical screen coords (account for DPI via GetSystemMetrics)
$sw = [CapApp]::GetSystemMetrics(0)
$sh = [CapApp]::GetSystemMetrics(1)
Write-Output "screen ${sw}x${sh}"
$r2 = New-Object CapApp+RECT
[void][CapApp]::GetWindowRect($hwnd2, [ref]$r2)
# AGREE ~ center-right of modal ~ 57% x, 58% y of window
$spots = @(
  @(0.57, 0.57), @(0.58, 0.59), @(0.59, 0.61), @(0.56, 0.63)
)
foreach ($s in $spots) {
  $ax = $r2.L + [int](($r2.R - $r2.L) * $s[0])
  $ay = $r2.T + [int](($r2.B - $r2.T) * $s[1])
  [void][CapApp]::SetCursorPos($ax, $ay)
  Start-Sleep -Milliseconds 120
  [CapApp]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
  [CapApp]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 350
}
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Seconds 3

Capture-Win $hwnd2 (Join-Path $OutDir '15-homepage-warner.png')
Kill-Prof $marker2

# If homepage still bad, fall back to MCP clean page screenshot
$mcpHome = 'C:\Users\nadire\AppData\Local\Temp\cursor\screenshots\15-homepage-clean.png'
if (Test-Path $mcpHome) {
  $wbSize = (Get-Item (Join-Path $OutDir '15-homepage-warner.png')).Length
  # Prefer MCP clean page if chrome shot is small or we want guaranteed clean
  Copy-Item $mcpHome (Join-Path $OutDir '15-homepage-warner.png') -Force
  Write-Output "used MCP clean homepage fallback"
}

Get-Item (Join-Path $OutDir '14-trailer-youtube.png'), (Join-Path $OutDir '15-homepage-warner.png') |
  Format-Table Name, Length
