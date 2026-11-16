# =============================================================================
#  GATI POS - start.ps1
#  Menjalankan backend Laravel (server/) dan/atau frontend Vite (client/).
#
#  Contoh pakai:
#      .\start.bat                      # keduanya (default)
#      .\start.bat -Services frontend   # hanya POS/web klien
#      .\start.bat -Services backend    # hanya API + admin panel
#      .\start.bat -PhpExe C:\PHP83\php.exe
#
#  Server dijalankan ter-detach: menutup jendela ini TIDAK mematikannya.
#  Hentikan via .\stop.bat (atau stop.ps1).
# =============================================================================
[CmdletBinding()]
param(
    [ValidateSet('both', 'frontend', 'backend')]
    [string]$Services = 'both',

    # Path absolut php.exe (Laravel butuh PHP >= 8.3). Kosong = deteksi otomatis.
    [string]$PhpExe,

    # Host bind backend. 0.0.0.0 = bisa diakses dari perangkat di WiFi/LAN.
    [string]$BackendHost = '0.0.0.0',

    [int]$BackendPort  = 8000,
    [int]$FrontendPort = 5173,

    # Lewati seeding data contoh meski database baru dibuat.
    [switch]$NoSeed
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\common.ps1"

$root    = Get-RepoRoot
$logDir  = Join-Path $root 'logs'
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

# -----------------------------------------------------------------------------
function Start-Frontend {
    Write-Head ("Frontend - client/ (React 19 + Vite 7), port $FrontendPort")

    if (Test-PortListening -Port $FrontendPort) {
        Write-Warn "Port $FrontendPort sudah dipakai - frontend dianggap sudah jalan (skip)."
        return
    }

    $clientDir = Join-Path $root 'client'
    if (-not (Test-Path (Join-Path $clientDir 'node_modules'))) {
        Write-Info "node_modules belum ada - 'npm install' (sekali saja)..."
        Push-Location $clientDir
        try {
            & npm.cmd install
            if ($LASTEXITCODE -ne 0) { throw 'npm install gagal' }
        } finally { Pop-Location }
    }

    $logFile = Join-Path $logDir 'frontend.log'
    $errFile = Join-Path $logDir 'frontend.err.log'
    Write-Info "Memulai 'npm run dev' di client/ (log: logs\frontend.log)..."
    Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev' `
        -WorkingDirectory $clientDir -WindowStyle Hidden `
        -RedirectStandardOutput $logFile -RedirectStandardError $errFile | Out-Null

    Write-Info "Menunggu Vite siap di port $FrontendPort (max 60 detik)..."
    if (Wait-PortReady -Port $FrontendPort -TimeoutSeconds 60) {
        Write-Ok 'Frontend siap.'
    } else {
        Write-Warn "Belum siap di port $FrontendPort setelah 60 detik. Cek logs\frontend.log."
    }

    $lan = Get-LanIp
    Write-Ok "Kasir (POS)  : http://localhost:$FrontendPort/"
    Write-Ok "Pelayan       : http://localhost:$FrontendPort/pelayan"
    Write-Ok "Dapur (KDS)   : http://localhost:$FrontendPort/dapur"
    Write-Ok "Antrian       : http://localhost:$FrontendPort/antrian"
    Write-Ok "Self-order    : http://localhost:$FrontendPort/order/meja-01"
    if ($lan) { Write-Ok "WiFi/LAN     : http://${lan}:$FrontendPort/  (buka dari HP/tablet)" }
}

# -----------------------------------------------------------------------------
function Start-Backend {
    Write-Head "Backend - server/ (Laravel 13), port $BackendPort"

    if (Test-PortListening -Port $BackendPort) {
        Write-Warn "Port $BackendPort sudah dipakai - backend dianggap sudah jalan (skip)."
        return
    }

    $serverDir = Join-Path $root 'server'

    # 1) PHP yang kompatibel (>= 8.3)
    $php = if ($PhpExe) { $PhpExe } else { Resolve-PhpExe }
    if (-not $php -or -not (Test-Path $php)) {
        Write-Fail 'PHP >= 8.3 tidak ditemukan (backend Laravel 13 butuh >= 8.3).'
        Write-Fail 'Solusi:  pasang PHP 8.3+,  ATAU  set $env:PHP_PATH="C:\PHP83",'
        Write-Fail '         ATAU  jalankan:  .\start.bat -PhpExe "C:\PHP83\php.exe"'
        exit 1
    }
    $v = Get-PhpVersion -Exe $php
    Write-Info "PHP: $php  ( $($v.Major).$($v.Minor) )"

    # 2) Composer dependencies (sekali saja untuk clone baru)
    if (-not (Test-Path (Join-Path $serverDir 'vendor\autoload.php'))) {
        Write-Info "vendor/ belum ada - 'composer install' (sekali saja)..."
        $composer = Find-Composer
        if (-not $composer) {
            Write-Fail 'Composer tidak ditemukan di PATH. Pasang dulu: https://getcomposer.org'
            exit 1
        }
        Push-Location $serverDir
        try {
            & $composer install
            if ($LASTEXITCODE -ne 0) { throw 'composer install gagal' }
        } finally { Pop-Location }
    }

    # 3) Database SQLite + migrasi
    $dbFile  = Join-Path $serverDir 'database\database.sqlite'
    $dbFresh = -not (Test-Path $dbFile)
    if ($dbFresh) {
        Write-Info 'Membuat database SQLite: server\database\database.sqlite'
        New-Item -ItemType File -Path $dbFile | Out-Null
    }

    Push-Location $serverDir
    try {
        Write-Info 'Menjalankan: php artisan migrate --force'
        & $php artisan migrate --force 2>&1 |
            ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }

        if ($dbFresh -and -not $NoSeed) {
            Write-Info 'Database baru - php artisan db:seed (admin, produk, pesanan contoh)...'
            & $php artisan db:seed 2>&1 |
                ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        }
    } finally { Pop-Location }

    # 4) Serve
    $logFile = Join-Path $logDir 'backend.log'
    $errFile = Join-Path $logDir 'backend.err.log'
    Write-Info "Memulai 'php artisan serve' di ${BackendHost}:$BackendPort (log: logs\backend.log)..."
    Start-Process -FilePath $php `
        -ArgumentList 'artisan', 'serve', "--host=$BackendHost", "--port=$BackendPort" `
        -WorkingDirectory $serverDir -WindowStyle Hidden `
        -RedirectStandardOutput $logFile -RedirectStandardError $errFile | Out-Null

    Write-Info "Menunggu server Laravel siap di port $BackendPort (max 60 detik)..."
    if (Wait-PortReady -Port $BackendPort -TimeoutSeconds 60) {
        Write-Ok 'Backend siap.'
    } else {
        Write-Warn "Belum siap di port $BackendPort setelah 60 detik. Cek logs\backend.log."
    }

    $lan = Get-LanIp
    Write-Ok "API             : http://localhost:$BackendPort/api/products"
    Write-Ok "Admin (Filament): http://localhost:$BackendPort/admin"
    Write-Info 'Login admin     : admin@kasa.local / kasa-admin-2026'
    if ($lan -and $BackendHost -eq '0.0.0.0') {
        Write-Ok "WiFi/LAN       : http://${lan}:$BackendPort  (buka dari perangkat lain)"
    }
}

# -----------------------------------------------------------------------------
switch ($Services) {
    'both'     { Start-Frontend; Start-Backend }
    'frontend' { Start-Frontend }
    'backend'  { Start-Backend }
}

Write-Host ''
Write-Host 'Server jalan di background (detach). Untuk berhenti: .\stop.bat' -ForegroundColor DarkGray
Write-Host 'Cek status kapan saja: .\status.bat' -ForegroundColor DarkGray
