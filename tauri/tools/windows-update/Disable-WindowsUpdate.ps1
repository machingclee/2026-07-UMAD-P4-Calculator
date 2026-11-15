#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Turns automatic Windows Update off on Windows 11/10 Home or Pro, reversibly.

.DESCRIPTION
    Three layers, each of which Windows tries to undo on its own, so all three are applied:

      1. Policy        HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU  NoAutoUpdate=1
      2. Services      wuauserv, UsoSvc, WaaSMedicSvc  -> Start=4 (Disabled)
      3. Tasks         \Microsoft\Windows\WindowsUpdate,\UpdateOrchestrator,\WaaSMedic\... -> Disabled

    Layer 3 needs layer 2: WaaSMedicSvc ("Windows Update Medic") exists specifically to
    re-enable wuauserv and undo layer 1. UsoSvc is the Update Orchestrator, which 24H2+
    uses to trigger scans. WaaSMedicSvc's registry key is owned by TrustedInstaller, so
    the script takes ownership only of that one key and reports if it fails.

    A backup of every pre-existing value is written to .\backup\<timestamp>\ so
    Enable-WindowsUpdate.ps1 can put things back.

.PARAMETER KeepStoreWorking
    Do not disable UsoSvc. The Microsoft Store and some inbox app updates go through
    UsoSvc, so this keeps Store updates alive at the cost of leaving one update path on.

.PARAMETER SkipPolicy
    Only touch services and tasks (useful if you later want a Managed-by-policy display
    in Settings removed).

.PARAMETER HideSettingsPage
    Also set SetDisableUXWUAccess=1, removing the Windows Update page from Settings.
    Off by default: with it on, the page renders blank / "managed by your organization",
    which makes Windows look broken.

.EXAMPLE
    .\Disable-WindowsUpdate.ps1
.EXAMPLE
    .\Disable-WindowsUpdate.ps1 -KeepStoreWorking
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [switch]$KeepStoreWorking,
    [switch]$SkipPolicy,
    [switch]$HideSettingsPage,
    [string]$BackupRoot = (Join-Path $PSScriptRoot 'backup')
)

$ErrorActionPreference = 'Stop'
$stamp   = Get-Date -Format 'yyyyMMdd-HHmmss'
$workDir = Join-Path $BackupRoot $stamp
New-Item -ItemType Directory -Path $workDir -Force | Out-Null

$results = [System.Collections.Generic.List[object]]::new()
function Note([string]$Area, [string]$Item, [string]$Status) {
    $results.Add([pscustomobject]@{ Area = $Area; Item = $Item; Status = $Status })
    Write-Host ("  {0,-8} {1,-46} {2}" -f $Area, $Item, $Status)
}

# ---------------------------------------------------------------- 0. snapshot
$svcNames = @('wuauserv', 'UsoSvc', 'WaaSMedicSvc', 'BITS', 'DoSvc')
$snap = [ordered]@{ Services = @{}; Tasks = @{}; CapturedAt = (Get-Date).ToString('o') }

foreach ($n in $svcNames) {
    $key = "HKLM:\SYSTEM\CurrentControlSet\Services\$n"
    if (Test-Path $key) {
        $snap.Services[$n] = (Get-ItemProperty $key).Start
    }
}
$policyKeys = @(
    'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate',
    'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU'
)
foreach ($p in $policyKeys) {
    if (Test-Path $p) {
        & reg.exe export $p (Join-Path $workDir "$(($p -split '\\')[-1]).reg") /y 2>$null | Out-Null
    }
}

# Task Scheduler's WMI provider denies enumeration to non-elevated callers, and it does so
# by returning nothing rather than throwing, so probe for it explicitly.
$taskPaths = @(
    '\Microsoft\Windows\WindowsUpdate\',
    '\Microsoft\Windows\WaaSMedic\',
    '\Microsoft\Windows\UpdateOrchestrator\',
    '\Microsoft\Windows\InstallService\'
)
$canQueryTasks = [bool](Get-ScheduledTask -TaskPath '\Microsoft\Windows\WindowsUpdate\*' -ErrorAction SilentlyContinue)
if ($canQueryTasks) {
    foreach ($tp in $taskPaths) {
        foreach ($t in (Get-ScheduledTask -TaskPath "$tp*" -ErrorAction SilentlyContinue)) {
            $snap.Tasks["{0}{1}" -f $t.TaskPath, $t.TaskName] = [string]$t.State
        }
    }
}
$snap | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $workDir 'state.json') -Encoding UTF8

# ---------------------------------------------------------------- 1. policy
if (-not $SkipPolicy) {
    Write-Host "`n[1/3] Policy keys" -ForegroundColor Cyan
    $au = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU'
    $wu = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate'
    try {
        New-Item -Path $au -Force | Out-Null
        New-ItemProperty -Path $au -Name 'NoAutoUpdate' -Value 1 -PropertyType DWord -Force | Out-Null
        New-ItemProperty -Path $wu -Name 'DoNotConnectToWindowsUpdateInternetLocations' -Value 1 -PropertyType DWord -Force | Out-Null
        Note 'policy' 'AU\NoAutoUpdate = 1' 'OK'
        Note 'policy' 'DoNotConnect...InternetLocations = 1' 'OK'
        if ($HideSettingsPage) {
            New-ItemProperty -Path $wu -Name 'SetDisableUXWUAccess' -Value 1 -PropertyType DWord -Force | Out-Null
            Note 'policy' 'SetDisableUXWUAccess = 1' 'OK'
        }
    }
    catch { Note 'policy' $_.Exception.Message 'FAILED (not elevated?)' }
} else { Write-Host "`n[1/3] Policy keys skipped" -ForegroundColor DarkGray }

# ---------------------------------------------------------------- 2. services
Write-Host "`n[2/3] Services" -ForegroundColor Cyan
$targets = @('wuauserv', 'WaaSMedicSvc')
if (-not $KeepStoreWorking) { $targets += 'UsoSvc' }

foreach ($n in $targets) {
    $key = "HKLM:\SYSTEM\CurrentControlSet\Services\$n"
    if (-not (Test-Path $key)) { Note 'service' $n 'not present'; continue }

    # stop first so the change takes effect without a reboot
    & sc.exe stop $n 2>$null | Out-Null

    try {
        Set-ItemProperty -Path $key -Name 'Start' -Value 4 -Type DWord -ErrorAction Stop
        Note 'service' "$n -> Disabled" 'OK'
    }
    catch {
        if ($n -ne 'WaaSMedicSvc') {
            Note 'service' "$n -> Disabled" "FAILED: $($_.Exception.Message)"
            continue
        }

        # WaaSMedicSvc's key is owned by TrustedInstaller, so Administrators cannot write
        # Start. Take ownership of that ONE key, grant Administrators full control, retry.
        # (takeown.exe/icacls.exe do not work on registry keys - this has to be .NET.)
        $owned = $false
        try {
            $base   = [Microsoft.Win32.RegistryKey]::OpenBaseKey('LocalMachine', 'Default')
            $rel    = 'SYSTEM\CurrentControlSet\Services\WaaSMedicSvc'
            $readWr = [Microsoft.Win32.RegistryKeyPermissionCheck]::ReadWriteSubTree
            $take   = [System.Security.AccessControl.RegistryRights]::TakeOwnership
            $chPerm = [System.Security.AccessControl.RegistryRights]::ChangePermissions
            $admins = New-Object System.Security.Principal.NTAccount('BUILTIN\Administrators')

            $k1   = $base.OpenSubKey($rel, $readWr, $take)
            $acl  = $k1.GetAccessControl([System.Security.AccessControl.AccessControlSections]::None)
            $acl.SetOwner($admins)
            $k1.SetAccessControl($acl)
            $k1.Close()

            $k2   = $base.OpenSubKey($rel, $readWr, $chPerm)
            $acl2 = $k2.GetAccessControl()
            $rule = New-Object System.Security.AccessControl.RegistryAccessRule(
                        $admins, 'FullControl', 'ContainerInherit', 'None', 'Allow')
            $acl2.SetAccessRule($rule)
            $k2.SetAccessControl($acl2)
            $k2.Close()
            $owned = $true
        }
        catch { $owned = $false }

        if ($owned) {
            try {
                Set-ItemProperty -Path $key -Name 'Start' -Value 4 -Type DWord -ErrorAction Stop
                Note 'service' 'WaaSMedicSvc -> Disabled (ownership taken)' 'OK'
            }
            catch { Note 'service' 'WaaSMedicSvc -> Disabled' "FAILED: $($_.Exception.Message)" }
        }
        else {
            Note 'service' 'WaaSMedicSvc -> Disabled' 'FAILED: TrustedInstaller-owned key'
            Write-Host '         Windows Update Medic will re-enable wuauserv and undo the' -ForegroundColor Yellow
            Write-Host '         policy after a few weeks. Re-run this script from a SYSTEM shell:' -ForegroundColor Yellow
            Write-Host '         psexec -s -i powershell -ExecutionPolicy Bypass -File .\Disable-WindowsUpdate.ps1' -ForegroundColor Yellow
        }
    }
}

# BITS is left alone on purpose: BITS also serves WSUS-less app installers and backups.
Note 'service' 'BITS (left as-is)' 'skipped'

# ---------------------------------------------------------------- 3. tasks
Write-Host "`n[3/3] Scheduled tasks" -ForegroundColor Cyan
if (-not $canQueryTasks) {
    Note 'task' 'all four task folders' 'FAILED: cannot enumerate (shell not elevated)'
}
else {
    foreach ($tp in $taskPaths) {
        $tasks = Get-ScheduledTask -TaskPath "$tp*" -ErrorAction SilentlyContinue
        if (-not $tasks) { Note 'task' "$tp (folder empty)" 'nothing to do'; continue }
        foreach ($t in $tasks) {
            $id = "{0}{1}" -f $t.TaskPath, $t.TaskName
            try {
                if ($t.State -ne 'Disabled') {
                    Disable-ScheduledTask -TaskName $t.TaskName -TaskPath $t.TaskPath -ErrorAction Stop | Out-Null
                    Note 'task' $id 'Disabled'
                }
                else { Note 'task' $id 'already disabled' }
            }
            catch { Note 'task' $id 'FAILED (protected task)' }
        }
    }
}

# ---------------------------------------------------------------- report
$reportPath = Join-Path $workDir 'result.txt'
$results | Format-Table -AutoSize | Out-String -Width 200 | Set-Content $reportPath -Encoding UTF8

Write-Host "`nBackup of previous state: $workDir" -ForegroundColor Green
Write-Host "To undo:  .\Enable-WindowsUpdate.ps1 -BackupDir '$workDir'" -ForegroundColor Yellow
$failed = @($results | Where-Object Status -like 'FAILED*')
if ($failed) {
    Write-Host "`n$($failed.Count) step(s) failed (see above). Windows may restore update on its own." -ForegroundColor Yellow
}
