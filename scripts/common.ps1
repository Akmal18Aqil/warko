# =============================================================================
#  GATI POS - shared helpers untuk script dev (start.ps1 / stop.ps1 / status.ps1)
#  File ini TIDAK dijalankan langsung; di-dot-source oleh script lainnya:
#      . "$PSScriptRoot\common.ps1"
# =============================================================================

# Cegah re-definisi fungsi jika di-dot-source lebih dari sekali di session sama.
if (Test-Path variable:GatiPosCommonLoaded) { return }
$GatiPosCommonLoaded = $true

# Folder script = <repo>/scripts  ->  root repo = satu level di atasnya.
$GatiPosScriptDir = $PSScriptRoot

function Get-RepoRoot {
    return Split-Path -Parent $GatiPosScriptDir
}

# --- Logging berwarna --------------------------------------------------------
function Write-Head { param([string]$Msg) Write-Host "`n=== $Msg" -ForegroundColor White }
function Write-Info { param([string]$Msg) Write-Host "  $Msg" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Msg) Write-Host "  [OK] $Msg" -ForegroundColor Green }
function Write-Warn { param([string]$Msg) Write-Host "  [!]  $Msg" -ForegroundColor Yellow }
function Write-Fail { param([string]$Msg) Write-Host "  [X]  $Msg" -ForegroundColor Red }

# --- Jaringan ----------------------------------------------------------------
function Get-LanIp {
    # Ambil IPv4 non-loopback/non-APIPA, urut prioritas: 192.168.x > 10.x > 172.16-31.x
    $ips = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.PrefixOrigin -in 'Dhcp', 'Manual' } |
        Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } |
        Select-Object -ExpandProperty IPAddress)
    if ($ips.Count -eq 0) { return $null }
    foreach ($pattern in '^192\.168\.', '^10\.', '^172\.(1[6-9]|2[0-9]|3[01])\.') {
        $found = $ips | Where-Object { $_ -match $pattern } | Select-Object -First 1
        if ($found) { return $found }
    }
    return ($ips | Select-Object -First 1)
}

function Test-PortListening {
    param([int]$Port)
    $conns = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalPort -eq $Port -and $_.OwningProcess -gt 0 }
    return [bool]$conns
}

function Get-PortListenerPids {
    param([int]$Port)
    $conns = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalPort -eq $Port -and $_.OwningProcess -gt 0 }
    $pids = @()
    foreach ($c in $conns) {
        if ($c.OwningProcess -notin $pids) { $pids += $c.OwningProcess }
    }
    return $pids
}

function Wait-PortReady {
    param([int]$Port, [int]$TimeoutSeconds = 60)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortListening -Port $Port) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

# --- Proses ------------------------------------------------------------------
function Stop-ProcessTree {
    # Bunuh proses beserta seluruh child-nya secara rekursif.
    param([int]$ProcessId)
    $children = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.ParentProcessId -eq $ProcessId })
    foreach ($child in $children) {
        Stop-ProcessTree -ProcessId $child.ProcessId
    }
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

# --- Deteksi PHP (backend Laravel butuh PHP >= 8.3) ---------------------------
function Get-PhpVersion {
    param([string]$Exe)
    $line = (& $Exe -v 2>$null | Select-Object -First 1)
    if ($line -match 'PHP\s+(\d+)\.(\d+)') {
        return @{ Major = [int]$Matches[1]; Minor = [int]$Matches[2] }
    }
    return $null
}

function Resolve-PhpExe {
    # Urutan kandidat: $env:PHP_PATH -> php di PATH -> lokasi instalasi umum.
    $candidates = New-Object System.Collections.Generic.List[string]
    if ($env:PHP_PATH)                                  { $candidates.Add($env:PHP_PATH) }
    $inPath = (Get-Command php.exe -ErrorAction SilentlyContinue).Source
    if ($inPath)                                        { $candidates.Add($inPath) }
    foreach ($dir in @('C:\PHP83', 'C:\PHP84', 'C:\PHP85', 'C:\PHP', 'C:\php',
                       'C:\Program Files\php', 'C:\Program Files (x86)\php')) {
        $exe = Join-Path $dir 'php.exe'
        if (Test-Path $exe)                             { $candidates.Add($exe) }
    }
    # Laragon biasanya menyimpan versi PHP terbaru.
    foreach ($dir in @('C:\laragon\bin\php', 'D:\laragon\bin\php')) {
        if (Test-Path $dir) {
            Get-ChildItem $dir -Filter php.exe -Recurse -ErrorAction SilentlyContinue -Depth 1 |
                ForEach-Object { $candidates.Add($_.FullName) }
        }
    }

    $tooOld = @()
    foreach ($exe in $candidates) {
        if (-not (Test-Path $exe)) { continue }
        $v = Get-PhpVersion -Exe $exe
        if (-not $v) { continue }
        if ($v.Major -gt 8 -or ($v.Major -eq 8 -and $v.Minor -ge 3)) {
            return $exe   # Cukup baru - langsung dipakai.
        }
        $tooOld += "$exe (PHP $($v.Major).$($v.Minor))"
    }

    if ($tooOld.Count -gt 0) {
        Write-Warn "PHP >= 8.3 tidak ditemukan. Kandidat yang ketemu semuanya lebih lama:"
        foreach ($t in $tooOld) { Write-Warn "    $t" }
    }
    return $null
}

function Find-Composer {
    $composer = (Get-Command composer -ErrorAction SilentlyContinue).Source
    if (-not $composer) {
        foreach ($p in @('C:\ProgramData\ComposerSetup\bin\composer.bat',
                         "$env:USERPROFILE\composer\composer.bat",
                         'C:\composer\composer.bat')) {
            if (Test-Path $p) { return $p }
        }
    }
    return $composer
}
