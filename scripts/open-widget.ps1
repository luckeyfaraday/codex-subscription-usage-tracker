param(
  [int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 8080 }),
  [int]$Width = $(if ($env:ATHENA_WIDGET_WIDTH) { [int]$env:ATHENA_WIDGET_WIDTH } else { 430 }),
  [int]$Height = $(if ($env:ATHENA_WIDGET_HEIGHT) { [int]$env:ATHENA_WIDGET_HEIGHT } else { 760 }),
  [int]$Left = $(if ($env:ATHENA_WIDGET_LEFT) { [int]$env:ATHENA_WIDGET_LEFT } else { 80 }),
  [int]$Top = $(if ($env:ATHENA_WIDGET_TOP) { [int]$env:ATHENA_WIDGET_TOP } else { 80 }),
  [string]$TopMost = $(if ($env:ATHENA_WIDGET_TOPMOST) { $env:ATHENA_WIDGET_TOPMOST } else { "true" }),
  [string]$ClickThrough = $(if ($env:ATHENA_WIDGET_CLICK_THROUGH) { $env:ATHENA_WIDGET_CLICK_THROUGH } else { "true" })
)

$ErrorActionPreference = "Stop"

function Convert-WidgetBoolean {
  param(
    [string]$Name,
    [string]$Value
  )

  switch ($Value.Trim().ToLowerInvariant()) {
    "1" { return $true }
    "true" { return $true }
    "yes" { return $true }
    "on" { return $true }
    "0" { return $false }
    "false" { return $false }
    "no" { return $false }
    "off" { return $false }
    default { throw "$Name must be true/false or 1/0. Received: $Value" }
  }
}

$TopMostEnabled = Convert-WidgetBoolean -Name "TopMost" -Value $TopMost
$ClickThroughEnabled = Convert-WidgetBoolean -Name "ClickThrough" -Value $ClickThrough

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$BaseUrl = "http://127.0.0.1:$Port/widget.html"
$Url = "$($BaseUrl)?v=$(Get-Date -Format yyyyMMddHHmmss)"
$ProfileDir = if ($env:ATHENA_WIDGET_PROFILE) {
  $env:ATHENA_WIDGET_PROFILE
} else {
  Join-Path $env:TEMP "athena-usage-tracker-widget-profile-$PID"
}
$LogFile = if ($env:ATHENA_WIDGET_LOG) {
  $env:ATHENA_WIDGET_LOG
} else {
  Join-Path $env:TEMP "athena-usage-tracker-widget.log"
}

function Test-WidgetReady {
  try {
    Invoke-WebRequest -UseBasicParsing $BaseUrl -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Resolve-Chrome {
  if ($env:ATHENA_WIDGET_CHROME -and (Test-Path $env:ATHENA_WIDGET_CHROME)) {
    return $env:ATHENA_WIDGET_CHROME
  }

  $candidates = @(
    (Join-Path ${env:ProgramFiles} "Google\Chrome\Application\chrome.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
    (Join-Path ${env:LOCALAPPDATA} "Google\Chrome\Application\chrome.exe")
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  $command = Get-Command "chrome.exe" -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  throw "Chrome was not found. Set ATHENA_WIDGET_CHROME to the full path of chrome.exe."
}

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class WidgetWindow {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll")]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

  [DllImport("user32.dll")]
  public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int processId);

  [DllImport("user32.dll", EntryPoint="GetWindowLongPtr")]
  public static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int nIndex);

  [DllImport("user32.dll", EntryPoint="SetWindowLongPtr")]
  public static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

  [DllImport("user32.dll", EntryPoint="GetWindowLong")]
  public static extern IntPtr GetWindowLong32(IntPtr hWnd, int nIndex);

  [DllImport("user32.dll", EntryPoint="SetWindowLong")]
  public static extern IntPtr SetWindowLong32(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

  [DllImport("user32.dll")]
  public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

  public static IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex) {
    return IntPtr.Size == 8 ? GetWindowLongPtr64(hWnd, nIndex) : GetWindowLong32(hWnd, nIndex);
  }

  public static IntPtr SetWindowLongPtr(IntPtr hWnd, int nIndex, IntPtr dwNewLong) {
    return IntPtr.Size == 8 ? SetWindowLongPtr64(hWnd, nIndex, dwNewLong) : SetWindowLong32(hWnd, nIndex, dwNewLong);
  }
}
"@

function Get-WidgetWindowHandle {
  param([datetime]$StartedAfter)

  $chromeProcesses = Get-Process chrome -ErrorAction SilentlyContinue |
    Where-Object { $_.StartTime -ge $StartedAfter.AddSeconds(-2) -and $_.MainWindowHandle -ne 0 }

  foreach ($process in $chromeProcesses) {
    if ($process.MainWindowTitle -match "Almanac|Athena|Pocket") {
      return $process.MainWindowHandle
    }
  }

  foreach ($process in $chromeProcesses) {
    return $process.MainWindowHandle
  }

  $handles = New-Object System.Collections.Generic.List[System.IntPtr]
  $processIds = @{}
  Get-Process chrome -ErrorAction SilentlyContinue |
    Where-Object { $_.StartTime -ge $StartedAfter.AddSeconds(-2) } |
    ForEach-Object { $processIds[[int]$_.Id] = $true }

  [WidgetWindow]::EnumWindows({
    param([IntPtr]$hWnd, [IntPtr]$lParam)

    if (-not [WidgetWindow]::IsWindowVisible($hWnd)) {
      return $true
    }

    $windowProcessId = 0
    [WidgetWindow]::GetWindowThreadProcessId($hWnd, [ref]$windowProcessId) | Out-Null
    if (-not $processIds.ContainsKey($windowProcessId)) {
      return $true
    }

    $title = New-Object System.Text.StringBuilder 256
    [WidgetWindow]::GetWindowText($hWnd, $title, $title.Capacity) | Out-Null
    if ($title.ToString() -match "Almanac|Athena|Pocket") {
      $handles.Add($hWnd)
      return $false
    }

    return $true
  }, [IntPtr]::Zero) | Out-Null

  if ($handles.Count -gt 0) {
    return $handles[0]
  }

  return [IntPtr]::Zero
}

function Set-WidgetOverlayMode {
  param(
    [IntPtr]$Handle,
    [bool]$MakeTopMost,
    [bool]$MakeClickThrough
  )

  if ($Handle -eq [IntPtr]::Zero) {
    Write-Warning "Could not find the widget window to apply persistent overlay mode."
    return
  }

  $GWL_EXSTYLE = -20
  $WS_EX_TRANSPARENT = 0x00000020
  $WS_EX_TOOLWINDOW = 0x00000080
  $HWND_TOPMOST = [IntPtr]::new(-1)
  $SWP_NOMOVE = 0x0002
  $SWP_NOSIZE = 0x0001
  $SWP_NOACTIVATE = 0x0010

  if ($MakeClickThrough) {
    $style = [WidgetWindow]::GetWindowLongPtr($Handle, $GWL_EXSTYLE).ToInt64()
    $style = $style -bor $WS_EX_TRANSPARENT -bor $WS_EX_TOOLWINDOW
    [WidgetWindow]::SetWindowLongPtr($Handle, $GWL_EXSTYLE, [IntPtr]::new($style)) | Out-Null
  }

  if ($MakeTopMost) {
    [WidgetWindow]::SetWindowPos($Handle, $HWND_TOPMOST, 0, 0, 0, 0, $SWP_NOMOVE -bor $SWP_NOSIZE -bor $SWP_NOACTIVATE) | Out-Null
  }
}

if (-not (Test-WidgetReady)) {
  $serverCommand = "Set-Location -LiteralPath '$Root'; npm start *> '$LogFile'"
  Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -ArgumentList "-NoProfile", "-Command", $serverCommand

  $ready = $false
  for ($i = 0; $i -lt 50; $i++) {
    Start-Sleep -Milliseconds 200
    if (Test-WidgetReady) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    throw "Athena Usage Tracker did not become ready on port $Port. Log: $LogFile"
  }
}

New-Item -ItemType Directory -Force $ProfileDir | Out-Null
$Chrome = Resolve-Chrome

$chromeArgs = @(
  "--user-data-dir=$ProfileDir",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-session-crashed-bubble",
  "--disable-features=Translate",
  "--app=$Url",
  "--class=AthenaUsageTrackerWidget",
  "--window-size=$Width,$Height",
  "--window-position=$Left,$Top",
  "--disable-application-cache",
  "--disk-cache-size=1"
)

$startedAt = Get-Date
Start-Process -FilePath $Chrome -ArgumentList $chromeArgs | Out-Null

for ($i = 0; $i -lt 50; $i++) {
  Start-Sleep -Milliseconds 100
  $windowHandle = Get-WidgetWindowHandle -StartedAfter $startedAt
  if ($windowHandle -ne [IntPtr]::Zero) {
    Set-WidgetOverlayMode -Handle $windowHandle -MakeTopMost $TopMostEnabled -MakeClickThrough $ClickThroughEnabled
    break
  }
}
