$ErrorActionPreference = 'Continue'
$OutDir = 'C:\Users\nadire\Desktop\nadire-portfolio\assets\staj-cpp'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$exe = 'C:\Users\nadire\Desktop\StajProje_CPP\build-mingw\StajProje_CPP.exe'
$stl = 'C:\Users\nadire\Desktop\StajProje_CPP\samples\cube.stl'
$env:PATH = "C:\Qt\Tools\mingw1310_64\bin;C:\Qt\6.9.0\mingw_64\bin;" + $env:PATH

Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Drawing, System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class CapStaj {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, int flags);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
}
"@

function Kill-App {
  Get-Process StajProje_CPP -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500
}

function Wait-App([int]$sec = 15) {
  for ($i = 0; $i -lt $sec; $i++) {
    Start-Sleep -Seconds 1
    $p = Get-Process StajProje_CPP -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
    if ($p) { return $p }
  }
  return $null
}

function Capture-Win([IntPtr]$hwnd, [string]$path) {
  [void][CapStaj]::ShowWindow($hwnd, 3)
  [void][CapStaj]::SetForegroundWindow($hwnd)
  Start-Sleep -Milliseconds 600
  $r = New-Object CapStaj+RECT
  [void][CapStaj]::GetWindowRect($hwnd, [ref]$r)
  $w = [Math]::Max(200, $r.R - $r.L)
  $h = [Math]::Max(200, $r.B - $r.T)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $hdc = $g.GetHdc()
  [void][CapStaj]::PrintWindow($hwnd, $hdc, 2)
  $g.ReleaseHdc($hdc)
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "saved $path ($w x $h) $((Get-Item $path).Length)"
}

function Click-Named([IntPtr]$hwnd, [string]$name) {
  $root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
  $cond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty, $name)
  $el = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
  if (-not $el) {
    Write-Output "NOT FOUND: $name"
    return $false
  }
  $pat = $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
  $pat.Invoke()
  Write-Output "clicked $name"
  Start-Sleep -Milliseconds 800
  return $true
}

function Set-Spin([IntPtr]$hwnd, [string]$nameHint, [string]$value) {
  # Fallback: tab through is hard; use Apply Point after setting via SendKeys focus
}

# --- 01 empty ---
Kill-App
Start-Process $exe
$p = Wait-App
$hwnd = [IntPtr]$p.MainWindowHandle
Start-Sleep -Seconds 2
Capture-Win $hwnd (Join-Path $OutDir '01-empty.png')
Kill-App

# --- 02 model loaded ---
Start-Process $exe -ArgumentList "`"$stl`""
$p = Wait-App
$hwnd = [IntPtr]$p.MainWindowHandle
Start-Sleep -Seconds 2
Capture-Win $hwnd (Join-Path $OutDir '02-model-loaded.png')

# --- 03/04/05 camera views ---
Click-Named $hwnd 'X' | Out-Null
# buttons may be unnamed - try by help text or AutomationId; fallback SendKeys not available
# Tool buttons often expose AccessibleName from tooltip/text. Icons may have empty name.
# Try clicking Take Section after apply point with spins

# Apply a center point via UI: set spins if accessible
$root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
$spins = $root.FindAll(
  [System.Windows.Automation.TreeScope]::Descendants,
  (New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Spinner)))
Write-Output "spinners=$($spins.Count)"

# Click Apply Point with default 0,0,0 (normalized center-ish)
Click-Named $hwnd 'Apply Point' | Out-Null
Start-Sleep -Seconds 1
Capture-Win $hwnd (Join-Path $OutDir '03-point-applied.png')

Click-Named $hwnd 'Take Section' | Out-Null
Start-Sleep -Seconds 1
Capture-Win $hwnd (Join-Path $OutDir '04-section-x.png')

# Change axis to y via combo if possible
$combos = $root.FindAll(
  [System.Windows.Automation.TreeScope]::Descendants,
  (New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::ComboBox)))
Write-Output "combos=$($combos.Count)"
if ($combos.Count -ge 1) {
  $axis = $combos.Item(0)
  $exp = $axis.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
  $exp.Expand()
  Start-Sleep -Milliseconds 300
  $yItem = $axis.FindFirst(
    [System.Windows.Automation.TreeScope]::Descendants,
    (New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::NameProperty, 'y')))
  if ($yItem) {
    $sel = $yItem.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
    $sel.Select()
    Write-Output 'selected y'
  }
  Start-Sleep -Milliseconds 400
}
Click-Named $hwnd 'Take Section' | Out-Null
Start-Sleep -Seconds 1
Capture-Win $hwnd (Join-Path $OutDir '05-section-y.png')

if ($combos.Count -ge 1) {
  $axis = $combos.Item(0)
  $exp = $axis.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
  $exp.Expand()
  Start-Sleep -Milliseconds 300
  $zItem = $axis.FindFirst(
    [System.Windows.Automation.TreeScope]::Descendants,
    (New-Object System.Windows.Automation.PropertyCondition(
      [System.Windows.Automation.AutomationElement]::NameProperty, 'z')))
  if ($zItem) {
    $sel = $zItem.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern)
    $sel.Select()
    Write-Output 'selected z'
  }
}
Click-Named $hwnd 'Take Section' | Out-Null
Start-Sleep -Seconds 1
Capture-Win $hwnd (Join-Path $OutDir '06-section-z.png')

# Transparency - move slider
$sliders = $root.FindAll(
  [System.Windows.Automation.TreeScope]::Descendants,
  (New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Slider)))
if ($sliders.Count -ge 1) {
  $range = $sliders.Item(0).GetCurrentPattern([System.Windows.Automation.RangeValuePattern]::Pattern)
  $range.SetValue(20)
  Write-Output 'alpha=0.20'
  Start-Sleep -Seconds 1
}
Capture-Win $hwnd (Join-Path $OutDir '07-transparency.png')

# Try Export CSV - may open save dialog; cancel after capture attempt
# Skip file dialog - just show enabled state is enough from previous shots

Kill-App
Get-ChildItem $OutDir | Format-Table Name, Length
