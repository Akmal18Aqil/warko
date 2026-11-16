# =============================================================================
#  GATI POS - stop.ps1
#  Menghentikan backend Laravel (port 8000) dan/atau frontend Vite (port 5173).
#
#  Contoh pakai:
#      .\stop.bat                      # stop keduanya (default)
#      .\stop.bat -Services frontend   # hanya frontend
#      .\stop.bat -Services backend    # hanya backend
#
#  Cara kerja: mencari proses yang "listen" di port terkait, lalu mematikan
#  prosesnya beserta seluruh child process (npm -> node -> vite/esbuild,
#  artisan -> php -S) secara rekursif.
# =============================================================================
[CmdletBinding()]
param(
    [ValidateSet('both', 'frontend', 'backend')]
    [string]$Services = 'both',

    [int]$BackendPort  = 8000,
    [int]$FrontendPort = 5173
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\common.ps1"

# -----------------------------------------------------------------------------
function Stop-ByPort {
    param([string]$Label, [int]$Port)

    $pids = Get-PortListenerPids -Port $Port
    if ($pids.Count -eq 0) {
        Write-Info "${Label}: port $Port bebas (sudah berhenti / belum pernah jalan)."
        return
    }

    foreach ($procId in $pids) {
        $name = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
        Write-Info "${Label}: menghentikan PID $procId ($name) yang listen di port $Port ..."
        Stop-ProcessTree -ProcessId $procId
    }

    # Beri waktu port dilepas oleh OS.
    $deadline = (Get-Date).AddSeconds(10)
    while ((Get-Date) -lt $deadline -and (Test-PortListening -Port $Port)) {
        Start-Sleep -Milliseconds 400
    }

    if (Test-PortListening -Port $Port) {
        Write-Warn "${Label}: port $Port masih sibuk. Mungkin ada proses lain di luar kendali script."
    } else {
        Write-Ok "${Label}: dihentikan. Port $Port bebas."
    }
}

# -----------------------------------------------------------------------------
switch ($Services) {
    'both'     { Stop-ByPort -Label 'Frontend' -Port $FrontendPort
                 Stop-ByPort -Label 'Backend ' -Port $BackendPort }
    'frontend' { Stop-ByPort -Label 'Frontend' -Port $FrontendPort }
    'backend'  { Stop-ByPort -Label 'Backend ' -Port $BackendPort }
}
