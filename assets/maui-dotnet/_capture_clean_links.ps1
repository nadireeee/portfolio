$ErrorActionPreference = 'Continue'
$OutDir = 'C:\Users\nadire\Desktop\nadire-portfolio\assets\maui-dotnet'
$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) {
  $chrome = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
}

Add-Type -AssemblyName System.Drawing, System.Windows.Forms, UIAutomationClient, UIAutomationTypes
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class CapClean {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, int flags);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, UIntPtr e);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
}
"@

function Capture-Win([IntPtr]$hwnd, [string]$path) {
  [void][CapClean]::ShowWindow($hwnd, 3)
  [void][CapClean]::SetForegroundWindow($hwnd)
  Start-Sleep -Milliseconds 700
  $r = New-Object CapClean+RECT
  [void][CapClean]::GetWindowRect($hwnd, [ref]$r)
  $w = [Math]::Max(200, $r.R - $r.L)
  $h = [Math]::Max(200, $r.B - $r.T)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $hdc = $g.GetHdc()
  [void][CapClean]::PrintWindow($hwnd, $hdc, 2)
  $g.ReleaseHdc($hdc)
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "saved $path $((Get-Item $path).Length)"
}

function Kill-ProfileChrome([string]$prof) {
  Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*$prof*" -or $_.CommandLine -like '*remote-debugging-port=9333*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

Kill-ProfileChrome 'maui-cdp'
Start-Sleep -Seconds 1

$prof = Join-Path $env:TEMP ("maui-cdp-" + (Get-Random))
New-Item -ItemType Directory -Force -Path $prof | Out-Null

# Embed = no recommendation sidebar, single clean player
$trailerUrl = 'https://www.youtube.com/embed/6hB3S9bIaco?autoplay=1&rel=0'
Start-Process $chrome -ArgumentList @(
  "--remote-debugging-port=9333",
  "--user-data-dir=`"$prof`"",
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--start-maximized',
  $trailerUrl
)

for ($i = 0; $i -lt 25; $i++) {
  try {
    Invoke-RestMethod 'http://127.0.0.1:9333/json/version' | Out-Null
    break
  } catch {
    Start-Sleep -Seconds 1
  }
}
Start-Sleep -Seconds 5

$p = Get-Process chrome | Where-Object { $_.MainWindowHandle -ne 0 } |
  Sort-Object StartTime -Descending | Select-Object -First 1
Capture-Win ([IntPtr]$p.MainWindowHandle) (Join-Path $OutDir '14-trailer-youtube.png')

# Open homepage in same profile as only tab: close youtube, open warner
try {
  $null = Invoke-RestMethod -Method Put -Uri 'http://127.0.0.1:9333/json/new?https://www.warnerbros.com/movies/shawshank-redemption'
  Start-Sleep -Seconds 2
  $tabs = Invoke-RestMethod 'http://127.0.0.1:9333/json'
  foreach ($t in $tabs) {
    if ($t.type -eq 'page' -and $t.url -like '*youtube*') {
      try { Invoke-RestMethod "http://127.0.0.1:9333/json/close/$($t.id)" | Out-Null } catch {}
    }
  }
} catch {
  Write-Output "CDP new tab failed: $_"
}

Start-Sleep -Seconds 6

$p2 = Get-Process chrome | Where-Object {
  $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -match 'Warner|Shawshank'
} | Select-Object -First 1
if (-not $p2) {
  $p2 = Get-Process chrome | Where-Object { $_.MainWindowHandle -ne 0 } |
    Sort-Object StartTime -Descending | Select-Object -First 1
}
$hwnd = [IntPtr]$p2.MainWindowHandle
[void][CapClean]::SetForegroundWindow($hwnd)
Start-Sleep -Milliseconds 400

# Try UIA AGREE
$root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
$btnCond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
  [System.Windows.Automation.ControlType]::Button
)
$buttons = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $btnCond)
$clicked = $false
foreach ($b in $buttons) {
  $n = $b.Current.Name
  if ($n -match '^(AGREE|Accept|Kabul)') {
    $pat = $b.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $pat.Invoke()
    Write-Output "invoked: $n"
    $clicked = $true
    break
  }
}

if (-not $clicked) {
  Write-Output 'AGREE UIA miss — mouse grid'
  $r = New-Object CapClean+RECT
  [void][CapClean]::GetWindowRect($hwnd, [ref]$r)
  $spots = @(
    @(0.58, 0.58), @(0.58, 0.60), @(0.60, 0.62),
    @(0.55, 0.65), @(0.62, 0.55), @(0.50, 0.60)
  )
  foreach ($pct in $spots) {
    $ax = $r.L + [int](($r.R - $r.L) * $pct[0])
    $ay = $r.T + [int](($r.B - $r.T) * $pct[1])
    [void][CapClean]::SetCursorPos($ax, $ay)
    Start-Sleep -Milliseconds 100
    [CapClean]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
    [CapClean]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 300
  }
}

Start-Sleep -Seconds 3
Capture-Win $hwnd (Join-Path $OutDir '15-homepage-warner.png')

Kill-ProfileChrome $prof
Get-Item (Join-Path $OutDir '14-trailer-youtube.png'), (Join-Path $OutDir '15-homepage-warner.png') |
  Format-Table Name, Length
