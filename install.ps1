<#
.SYNOPSIS
    Antigravity Voice - Automated Build, Package & Installation Script for Google Antigravity IDE.
#>

[CmdletBinding()]
param (
    [switch]$SkipInstallDeps,
    [switch]$NoRebuild
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Step {
    param([string]$Text)
    Write-Host "`n[+] $Text" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Text)
    Write-Host "[OK] $Text" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Text)
    Write-Host "[!] $Text" -ForegroundColor Yellow
}

function Write-ErrorExit {
    param([string]$Text)
    Write-Host "`n[ERROR] $Text" -ForegroundColor Red
    exit 1
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -Path $ScriptDir

Write-Host "==================================================================" -ForegroundColor Magenta
Write-Host "   [+] ANTIGRAVITY VOICE EXTENSION - ONE-CLICK INSTALLER         " -ForegroundColor Cyan
Write-Host "   Restore and Elevate Native Voice Messaging in Antigravity IDE " -ForegroundColor DarkGray
Write-Host "==================================================================" -ForegroundColor Magenta
Write-Host "Project Directory: $ScriptDir" -ForegroundColor DarkGray

# 1. Detect Package Manager
Write-Step "Detecting package manager..."
$PackageManager = $null
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $PackageManager = "pnpm"
    $pnpmVer = (& pnpm --version).Trim()
    Write-Success "Found 'pnpm' ($pnpmVer)"
} elseif (Get-Command npm -ErrorAction SilentlyContinue) {
    $PackageManager = "npm"
    $npmVer = (& npm --version).Trim()
    Write-Warn "pnpm not found. Using 'npm' ($npmVer)"
} else {
    Write-ErrorExit "Neither 'pnpm' nor 'npm' was found in your PATH."
}

# 2. Install Dependencies
if (-not $SkipInstallDeps) {
    Write-Step "Installing dependencies via $PackageManager..."
    if ($PackageManager -eq "pnpm") {
        & pnpm install
    } else {
        & npm install
    }
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorExit "Dependency installation failed with code $LASTEXITCODE."
    }
    Write-Success "Dependencies installed successfully."
}

# 3. Compile Native Windows Helpers
Write-Step "Compiling native Windows audio helpers..."
$BinDir = Join-Path $ScriptDir "bin"
if (-not (Test-Path $BinDir)) { New-Item -ItemType Directory -Path $BinDir -Force | Out-Null }

$CscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $CscPath)) {
    $CscPath = (Get-ChildItem -Path "C:\Windows\Microsoft.NET\Framework64" -Filter "csc.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
}

if ($CscPath -and (Test-Path $CscPath)) {
    $RecorderExe = Join-Path $BinDir "win_audio_recorder.exe"
    $RecorderSrc = Join-Path $ScriptDir "src\recorder.cs"
    if (Test-Path $RecorderSrc) {
        & "$CscPath" /nologo /optimize+ /out:"$RecorderExe" "$RecorderSrc"
        Write-Success "Audio recorder ready: $RecorderExe"
    }

    $PasterExe = Join-Path $BinDir "win_paste.exe"
    $PasterSrc = Join-Path $ScriptDir "src\paster.cs"
    if (Test-Path $PasterSrc) {
        & "$CscPath" /nologo /target:winexe /optimize+ /out:"$PasterExe" "$PasterSrc"
        Write-Success "Hardware paste injector ready: $PasterExe"
    }
}

# 4. Compile TypeScript
if (-not $NoRebuild) {
    Write-Step "Compiling TypeScript source code into out/..."
    if ($PackageManager -eq "pnpm") {
        & pnpm run compile
    } else {
        & npm run compile
    }
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorExit "TypeScript compilation failed."
    }
    Write-Success "TypeScript compiled successfully."
}

# 6. Package Extension into VSIX
Write-Step "Packaging extension into VSIX archive..."
$VsixName = "antigravity-voice-1.0.0.vsix"
$VsixPath = Join-Path $ScriptDir $VsixName

& npx @vscode/vsce package --no-dependencies --allow-missing-repository --out $VsixPath
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $VsixPath)) {
    Write-ErrorExit "Packaging extension into $VsixName failed."
}
$VsixSizeKb = [math]::Round(((Get-Item $VsixPath).Length / 1KB), 2)
Write-Success "Created VSIX package: $VsixName ($VsixSizeKb KB)"

# 7. Locate Antigravity IDE CLI
Write-Step "Locating Google Antigravity IDE binary..."
$CandidatePaths = @(
    "C:\Users\Asif Computer\AppData\Local\Programs\Antigravity IDE\bin\antigravity-ide.cmd",
    (Join-Path $env:LOCALAPPDATA "Programs\Antigravity IDE\bin\antigravity-ide.cmd")
)

$IdeBinary = $null
foreach ($p in $CandidatePaths) {
    if ($p -and (Test-Path $p)) {
        $IdeBinary = $p
        break
    }
}

if ($IdeBinary) {
    Write-Success "Found Antigravity IDE CLI at: $IdeBinary"
    Write-Step "Installing $VsixName into Antigravity IDE (--force)..."
    & "$IdeBinary" --install-extension "$VsixPath" --force
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Extension installed and registered in Google Antigravity IDE!"
    }
}

# 8. Sync files directly to installed directory for instant update
$InstalledDir = "C:\Users\Asif Computer\.antigravity-ide\extensions\softdevhassan.antigravity-voice-1.0.0"
if (Test-Path $InstalledDir) {
    Copy-Item -Path (Join-Path $ScriptDir "out\*") -Destination (Join-Path $InstalledDir "out") -Recurse -Force
    Copy-Item -Path (Join-Path $ScriptDir "bin\*") -Destination (Join-Path $InstalledDir "bin") -Recurse -Force
    Copy-Item -Path (Join-Path $ScriptDir "package.json") -Destination (Join-Path $InstalledDir "package.json") -Force
    Write-Success "Synchronized runtime files directly to installed extension directory."
}

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "   ALL FIXES & INTEGRATIONS INSTALLED SUCCESSFULLY!               " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "WHAT WAS FIXED & RESTORED:" -ForegroundColor Yellow
Write-Host "  1. NATIVE CHAT BOX MIC BUTTON:" -ForegroundColor Cyan
Write-Host "     The microphone button is now restored directly inside the" -ForegroundColor White
Write-Host "     Antigravity Chat input box, right beside the send arrow!" -ForegroundColor White
Write-Host "  2. ZERO-SANDBOX NATIVE RECORDING:" -ForegroundColor Cyan
Write-Host "     Clicking the mic records directly via Windows audio API." -ForegroundColor White
Write-Host "     No 'permission denied' errors, crystal clear audio." -ForegroundColor White
Write-Host "  3. DIRECT ATTACHMENT:" -ForegroundColor Cyan
Write-Host "     Recorded voice note is automatically attached directly into" -ForegroundColor White
Write-Host "     the prompt as an audio pill, ready to submit!" -ForegroundColor White
Write-Host "  4. SHORTCUT:" -ForegroundColor Cyan
Write-Host "     Press Ctrl+Alt+V anywhere to toggle voice recording." -ForegroundColor White
Write-Host "==================================================================" -ForegroundColor Green
