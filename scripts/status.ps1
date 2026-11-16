# =============================================================================
#  GATI POS - status.ps1
#  Mengecek apakah backend (port 8000) dan frontend (port 5173) sedang jalan.
#
#  Contoh pakai:
#      .\status.bat                      # status keduanya (default)
#      .\status.bat -Services frontend
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
function Show-Status {
    param([string]$Label, [int]$Port, [string]$Url)

    if (Test-PortListening -Port $Port) {
        $pids  = (Get-PortListenerPids -Port $Port) -join ', '
        $names = foreach ($procId in (Get-PortListenerPids -Port $Port)) {
            (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
        }
        Write-Ok "$Label : BERJALAN di $Url  (PID: $pids / $($names -join ', '))"
    } else {
        Write-Info "$Label : berhenti (port $Port bebas). Jalankan .\start.bat"
    }
}

# -----------------------------------------------------------------------------
switch ($Services) {
    'both'     { Show-Status -Label 'Frontend' -Port $FrontendPort -Url "http://localhost:$FrontendPort/"
                 Show-Status -Label 'Backend ' -Port $BackendPort -Url "http://localhost:$BackendPort/admin" }
    'frontend' { Show-Status -Label 'Frontend' -Port $FrontendPort -Url "http://localhost:$FrontendPort/" }
    'backend'  { Show-Status -Label 'Backend ' -Port $BackendPort -Url "http://localhost:$BackendPort/admin" }
}
