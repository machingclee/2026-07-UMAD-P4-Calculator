# Build a BMP-encoded .ico. Explorer ignores PNG-only ICOs and shows the default app icon.
param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Dest
)

Add-Type -AssemblyName System.Drawing

$sizes = @(16, 24, 32, 48, 64, 256)
$srcPath = (Resolve-Path $Source).Path
$src = [System.Drawing.Image]::FromFile($srcPath)

function Get-Dib([System.Drawing.Bitmap]$bmp) {
    $w = $bmp.Width
    $h = $bmp.Height
    $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
    $data = $bmp.LockBits(
        $rect,
        [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    try {
        $stride = $data.Stride
        $raw = New-Object byte[] ($stride * $h)
        [Runtime.InteropServices.Marshal]::Copy($data.Scan0, $raw, 0, $raw.Length)
    }
    finally {
        $bmp.UnlockBits($data)
    }

    $xor = New-Object byte[] ($w * 4 * $h)
    for ($y = 0; $y -lt $h; $y++) {
        $srcRow = ($h - 1 - $y) * $stride
        $dstRow = $y * $w * 4
        [Buffer]::BlockCopy($raw, $srcRow, $xor, $dstRow, $w * 4)
    }

    $maskStride = [Math]::Ceiling($w / 32.0) * 4
    $and = New-Object byte[] ($maskStride * $h)

    $header = New-Object byte[] 40
    $bw = New-Object IO.BinaryWriter (New-Object IO.MemoryStream)
    $bw.Write([int32]40)
    $bw.Write([int32]$w)
    $bw.Write([int32]($h * 2))
    $bw.Write([int16]1)
    $bw.Write([int16]32)
    $bw.Write([int32]0)
    $bw.Write([int32]($xor.Length + $and.Length))
    $bw.Write([int32]0)
    $bw.Write([int32]0)
    $bw.Write([int32]0)
    $bw.Write([int32]0)
    $header = $bw.BaseStream.ToArray()
    $bw.Dispose()

    $dib = New-Object byte[] ($header.Length + $xor.Length + $and.Length)
    [Buffer]::BlockCopy($header, 0, $dib, 0, $header.Length)
    [Buffer]::BlockCopy($xor, 0, $dib, $header.Length, $xor.Length)
    [Buffer]::BlockCopy($and, 0, $dib, $header.Length + $xor.Length, $and.Length)
    return $dib
}

$dibs = @()
foreach ($s in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $s, $s
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($src, 0, 0, $s, $s)
    $g.Dispose()
    $dibs += , (Get-Dib $bmp)
    $bmp.Dispose()
}
$src.Dispose()

$count = $sizes.Length
$dirBytes = 6 + (16 * $count)
$offset = $dirBytes
$ms = New-Object IO.MemoryStream
function Write-U16([IO.MemoryStream]$s, [uint16]$v) {
    $s.WriteByte($v -band 0xFF)
    $s.WriteByte(($v -shr 8) -band 0xFF)
}
function Write-U32([IO.MemoryStream]$s, [uint32]$v) {
    $s.WriteByte($v -band 0xFF)
    $s.WriteByte(($v -shr 8) -band 0xFF)
    $s.WriteByte(($v -shr 16) -band 0xFF)
    $s.WriteByte(($v -shr 24) -band 0xFF)
}
Write-U16 $ms 0
Write-U16 $ms 1
Write-U16 $ms $count
for ($i = 0; $i -lt $count; $i++) {
    $s = $sizes[$i]
    $len = $dibs[$i].Length
    $ms.WriteByte($(if ($s -ge 256) { 0 } else { $s }))
    $ms.WriteByte($(if ($s -ge 256) { 0 } else { $s }))
    $ms.WriteByte(0)
    $ms.WriteByte(0)
    Write-U16 $ms 1
    Write-U16 $ms 32
    Write-U32 $ms $len
    Write-U32 $ms $offset
    $offset += $len
}
foreach ($dib in $dibs) {
    $ms.Write($dib, 0, $dib.Length)
}
$outPath = $Dest
if (-not [IO.Path]::IsPathRooted($outPath)) {
    $outPath = Join-Path (Get-Location) $Dest
}
[IO.File]::WriteAllBytes($outPath, $ms.ToArray())
Write-Host "Wrote $outPath ($($ms.Length) bytes, BMP $($sizes -join ', '))"
