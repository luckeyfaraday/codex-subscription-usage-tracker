param(
  [int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 8080 }),
  [int]$Width = $(if ($env:ATHENA_WIDGET_WIDTH) { [int]$env:ATHENA_WIDGET_WIDTH } else { 430 }),
  [int]$Height = $(if ($env:ATHENA_WIDGET_HEIGHT) { [int]$env:ATHENA_WIDGET_HEIGHT } else { 760 }),
  [int]$Left = $(if ($env:ATHENA_WIDGET_LEFT) { [int]$env:ATHENA_WIDGET_LEFT } else { 80 }),
  [int]$Top = $(if ($env:ATHENA_WIDGET_TOP) { [int]$env:ATHENA_WIDGET_TOP } else { 80 })
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$BaseUrl = "http://127.0.0.1:$Port/widget.html"
$Url = "$BaseUrl?v=$(Get-Date -Format yyyyMMddHHmmss)"
$ProfileDir = if ($env:ATHENA_WIDGET_PROFILE) {
  $env:ATHENA_WIDGET_PROFILE
} else {
  Join-Path $env:TEMP "athena-usage-tracker-widget-profile"
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
  "--app=$Url",
  "--class=AthenaUsageTrackerWidget",
  "--window-size=$Width,$Height",
  "--window-position=$Left,$Top",
  "--disable-application-cache",
  "--disk-cache-size=1"
)

Start-Process -FilePath $Chrome -ArgumentList $chromeArgs
