# Turning off Windows Update on this machine

Target machine: **Windows 11 25H2 Home**, build **26200.9974**
(the registry `ProductName` still says "Windows 10 Home" — that string is stale on all Win11 installs;
`EditionID = Core` plus build 26200 means **Home**, so there is no `gpedit.msc`).

Because it is Home, the Group Policy Editor is unavailable. Policy *registry values* still work,
but Windows' own **Windows Update Medic Service (`WaaSMedicSvc`)** re-enables `wuauserv` and
removes those values after a few weeks. Any method that survives long-term has to deal with it.

## Options, cheapest first

| # | Method | Survives | Reversible | Notes |
|---|--------|----------|-----------|-------|
| 1 | **Settings → Windows Update → Pause updates** (1–5 weeks) | 5 weeks max | Yes, one click | Official, safe, no admin tricks. Best for "not right now". |
| 2 | **Registry policy only** (`AU\NoAutoUpdate=1`) | weeks–months | Delete key | Settings page shows "managed by your organization". Medic may undo it. |
| 3 | **Services + tasks + policy** (this folder) | until you undo it | Yes, `Enable-WindowsUpdate.ps1` | Needs elevation; strongest without third-party tools. |
| 4 | Third-party (e.g. Windows Update Blocker, WuMgr) | until undone | Yes | Same as #3 with a UI. Saves you trusting your own script. |

## Using these scripts

Both are for an **elevated** PowerShell (right-click → *Run as administrator*).
Execution policy on this machine is `Restricted`, so either bypass it per run:

```powershell
cd "C:\Repos\python\2026-07-UMAD-P4-Calculator\tauri\tools\windows-update"
powershell -ExecutionPolicy Bypass -File .\Disable-WindowsUpdate.ps1
```

…or, in the elevated window you already opened:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\Disable-WindowsUpdate.ps1
```

Useful switches:

```powershell
.\Disable-WindowsUpdate.ps1 -KeepStoreWorking   # leave UsoSvc alone so Store apps still update
.\Disable-WindowsUpdate.ps1 -HideSettingsPage   # also blank out Settings > Windows Update
.\Disable-WindowsUpdate.ps1 -SkipPolicy         # services + tasks only
```

What it does, and why all three layers:

1. **Policy** — `HKLM\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU\NoAutoUpdate = 1`
   plus `DoNotConnectToWindowsUpdateInternetLocations = 1`.
2. **Services** — `wuauserv`, `UsoSvc` and `WaaSMedicSvc` set to `Start=4` (Disabled).
   `WaaSMedicSvc`'s registry key is owned by **TrustedInstaller**, so the script takes ownership of
   that single key, grants Administrators write, and changes `Start`. If that fails, it says so and
   tells you to re-run from a SYSTEM shell (`psexec -s -i …`).
   `BITS` is deliberately left alone — other software uses it.
3. **Tasks** — disables everything under `\Microsoft\Windows\WindowsUpdate\`,
   `\WaaSMedic\`, `\UpdateOrchestrator\` and `\InstallService\`.

Every pre-existing value is written to `.\backup\<timestamp>\state.json` (with `.reg` exports of any
existing policy keys) before anything is changed.

## Undoing it

```powershell
powershell -ExecutionPolicy Bypass -File .\Enable-WindowsUpdate.ps1
# or, to restore the exact values that were captured:
powershell -ExecutionPolicy Bypass -File .\Enable-WindowsUpdate.ps1 -BackupDir .\backup\20261115-190000
```

It removes the policy keys, restores the stock service start types (`wuauserv=3`, `UsoSvc=2`,
`WaaSMedicSvc=3`), re-enables the tasks, runs `gpupdate /force`, and starts the services.
Reboot afterwards.

## What breaks while updates are off

- **Defender security intelligence** stops refreshing through Windows Update. If the machine matters,
  either re-enable monthly or install a definition package manually from
  <https://www.microsoft.com/en-us/wdsi/defenderupdates>.
- **Microsoft Store app updates** stop if you disabled `UsoSvc` (use `-KeepStoreWorking` to avoid this).
- **Feature/quality updates** obviously stop — including security patches, so the machine drifts out of
  support. Treat this as a temporary measure and re-enable before Patch Tuesday.
- Windows Update status in Settings may look blank or "managed by your organization". That is expected.

## What not to do

- **Don't** block `*.windowsupdate.com` in the firewall or hosts file. It half-works, breaks
  Defender and Store in confusing ways, and is a pain to fully undo.
- **Don't** delete `C:\Windows\SoftwareDistribution`. It frees nothing useful and can corrupt the
  update cache; stopping the services is enough.
- **Don't** disable the Windows Update *scheduled task* names you don't recognise — some
  (`UpdateOrchestrator\Schedule Scan`) are re-created by the Medic service anyway.

## Verified

- Both scripts parse clean (`[Parser]::ParseFile`, no errors).
- Ran `Disable-WindowsUpdate.ps1` unelevated in a temp copy: every privileged step is reported as
  `FAILED` and the script exits 0 without leaving partial state — failures are reported, not fatal.
- Machine facts read from `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion` and the service keys
  (CIM is blocked for non-elevated callers in this environment).
