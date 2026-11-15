#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Puts Windows Update back to its stock configuration.

.DESCRIPTION
    Reverses Disable-WindowsUpdate.ps1: removes the policy keys, restores the original
    service Start values (from the backup if one is supplied, otherwise Windows 11
    defaults), re-enables the update scheduled tasks, then starts the update stack.

    Run this before a monthly patch cycle if you intend to keep the machine patched.

.PARAMETER BackupDir
    A ..\backup\<timestamp>\ folder created by Disable-WindowsUpdate.ps1. Optional.

.EXAMPLE
    .\Enable-WindowsUpdate.ps1
.EXAMPLE
    .\Enable-WindowsUpdate.ps1 -BackupDir .\backup\20261115-190000
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$BackupDir
)

$ErrorActionPreference = 'Continue'

# ------------------------------------------------------------------ restore point
if ($PSCmdlet.ShouldProcess('System Restore', 'Create checkpoint')) {
    try {
        Enable-ComputerRestore -Drive "$env:SystemDrive\" -ErrorAction Stop
        Checkpoint-Computer -Description 'Before re-enabling Windows Update' `
                            -RestorePointType MODIFY_SETTINGS -ErrorAction Stop
        Write-Host 'Restore point created.' -ForegroundColor DarkGray
    }
    catch { Write-Host "Restore point skipped: $($_.Exception.Message)" -ForegroundColor DarkGray }
}

# ------------------------------------------------------------------ 1. policy
Write-Host "`n[1/3] Removing policy keys" -ForegroundColor Cyan
foreach ($p in @(
    'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU',
    'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate'
)) {
    if (Test-Path $p) {
        Remove-Item -Path $p -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path $p) { Write-Host "  FAILED to remove $p" -ForegroundColor Yellow }
        else { Write-Host "  removed $p" }
    }
    else { Write-Host "  absent  $p" -ForegroundColor DarkGray }
}

# ------------------------------------------------------------------ 2. services
Write-Host "`n[2/3] Restoring service start types" -ForegroundColor Cyan

# Windows 11 defaults: wuauserv = Manual(3), UsoSvc = Automatic(2), WaaSMedicSvc = Manual(3)
$defaults = @{ wuauserv = 3; UsoSvc = 2; WaaSMedicSvc = 3; BITS = 3 }

if ($BackupDir -and (Test-Path (Join-Path $BackupDir 'state.json'))) {
    $snap = Get-Content (Join-Path $BackupDir 'state.json') -Raw | ConvertFrom-Json
    foreach ($prop in $snap.Services.PSObject.Properties) {
        if ($null -ne $prop.Value) { $defaults[$prop.Name] = [int]$prop.Value }
    }
    Write-Host "  using saved values from $BackupDir" -ForegroundColor DarkGray
}

foreach ($n in $defaults.Keys) {
    $key = "HKLM:\SYSTEM\CurrentControlSet\Services\$n"
    if (-not (Test-Path $key)) { continue }
    try {
        Set-ItemProperty -Path $key -Name 'Start' -Value $defaults[$n] -Type DWord -ErrorAction Stop
        Write-Host ("  {0,-12} Start={1}" -f $n, $defaults[$n])
    }
    catch { Write-Host ("  {0,-12} FAILED: {1}" -f $n, $_.Exception.Message) -ForegroundColor Yellow }
}

# WaaSMedicSvc ownership: Disable-WindowsUpdate.ps1 may have taken ownership of its key
# (it ships owned by TrustedInstaller). Functionally harmless, but worth knowing about.
try {
    $owner = (Get-Acl 'HKLM:\SYSTEM\CurrentControlSet\Services\WaaSMedicSvc').Owner
    if ($owner -like '*Administrators*') {
        Write-Host "  note: WaaSMedicSvc key owner is '$owner' (originally TrustedInstaller)." -ForegroundColor DarkGray
    }
} catch { }

# ------------------------------------------------------------------ 3. tasks
Write-Host "`n[3/3] Re-enabling update tasks" -ForegroundColor Cyan
foreach ($tp in @(
    '\Microsoft\Windows\WindowsUpdate\',
    '\Microsoft\Windows\WaaSMedic\',
    '\Microsoft\Windows\UpdateOrchestrator\',
    '\Microsoft\Windows\InstallService\'
)) {
    $tasks = Get-ScheduledTask -TaskPath "$tp*" -ErrorAction SilentlyContinue
    if (-not $tasks) { Write-Host "  none under $tp" -ForegroundColor DarkGray; continue }
    foreach ($t in $tasks) {
        if ($t.State -eq 'Disabled') {
            try {
                Enable-ScheduledTask -TaskName $t.TaskName -TaskPath $t.TaskPath -ErrorAction Stop | Out-Null
                Write-Host ("  enabled {0}{1}" -f $t.TaskPath, $t.TaskName)
            }
            catch { Write-Host ("  FAILED  {0}{1}" -f $t.TaskPath, $t.TaskName) -ForegroundColor Yellow }
        }
    }
}

# ------------------------------------------------------------------ start stack
Write-Host "`nStarting services and refreshing policy" -ForegroundColor Cyan
& gpupdate.exe /force 2>$null | Out-Null
foreach ($n in @('wuauserv', 'UsoSvc', 'BITS')) {
    & sc.exe start $n 2>$null | Out-Null
    $s = Get-Service $n -ErrorAction SilentlyContinue
    if ($s) { Write-Host ("  {0,-12} {1}" -f $n, $s.Status) }
}

Write-Host "`nWindows Update is back to stock. Open Settings > Windows Update and click 'Check for updates'." -ForegroundColor Green
Write-Host "A reboot is recommended so the update stack reloads cleanly." -ForegroundColor Green
