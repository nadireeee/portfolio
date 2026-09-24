# Capture browser destinations for Watch Trailer / Visit Homepage
$ErrorActionPreference = 'Continue'
$OutDir = 'C:\Users\nadire\Desktop\nadire-portfolio\assets\maui-dotnet'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class BrWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdcBlt, int nFlags);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

function Capture-Hwnd([IntPtr]$hwnd, [string]$path) {
  if ($hwnd -eq [IntPtr]::Zero) { throw "no hwnd" }
  if ([BrWin]::IsIconic($hwnd)) { [void][BrWin]::ShowWindow($hwnd, 9) }
  [void][BrWin]::ShowWindow($hwnd, 3) # maximize
  [void][BrWin]::SetForegroundWindow($hwnd)
  Start-Sleep -Milliseconds 800
  $r = New-Object BrWin+RECT
  [void][BrWin]::GetWindowRect($hwnd, [ref]$r)
  $w = [Math]::Max(100, $r.Right - $r.Left)
  $h = [Math]::Max(100, $r.Bottom - $r.Top)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $hdc = $g.GetHdc()
  $ok = [BrWin]::PrintWindow($hwnd, $hdc, 2)
  $g.ReleaseHdc($hdc)
  if (-not $ok) {
    $g.CopyFromScreen($r.Left, $r.Top, 0, 0, (New-Object System.Drawing.Size($w,$h)))
  }
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  "saved $path ($w x $h)"
}

function Find-BrowserHwnd([string]$titleHint) {
  $procs = Get-Process chrome, msedge -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle }
  $hit = $procs | Where-Object { $_.MainWindowTitle -like "*$titleHint*" } | Select-Object -First 1
  if ($hit) { return [IntPtr]$hit.MainWindowHandle }
  $hit = $procs | Sort-Object StartTime -Descending | Select-Object -First 1
  if ($hit) { return [IntPtr]$hit.MainWindowHandle }
  return [IntPtr]::Zero
}

$trailer = 'https://www.youtube.com/watch?v=6hB3S9bIaco'
$home = 'https://www.warnerbros.com/movies/shawshank-redemption'

# Open trailer (same URL Launcher.OpenAsync uses for Shawshank)
Start-Process $trailer
Start-Sleep -Seconds 6
$hwnd = Find-BrowserHwnd 'YouTube'
if ($hwnd -eq [IntPtr]::Zero) { $hwnd = Find-BrowserHwnd 'Shawshank' }
if ($hwnd -eq [IntPtr]::Zero) { $hwnd = Find-BrowserHwnd '' }
Capture-Hwnd $hwnd (Join-Path $OutDir '14-trailer-youtube.png')

Start-Sleep -Seconds 1
Start-Process $home
Start-Sleep -Seconds 7
$hwnd2 = Find-BrowserHwnd 'Warner'
if ($hwnd2 -eq [IntPtr]::Zero) { $hwnd2 = Find-BrowserHwnd 'Shawshank' }
if ($hwnd2 -eq [IntPtr]::Zero) { $hwnd2 = Find-BrowserHwnd '' }
Capture-Hwnd $hwnd2 (Join-Path $OutDir '15-homepage-warner.png')

Get-Item (Join-Path $OutDir '14-trailer-youtube.png'), (Join-Path $OutDir '15-homepage-warner.png') |
  Select-Object Name, Length
