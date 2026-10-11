Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$publicDir = Join-Path $projectRoot "public"

function Create-SplashImage {
    param(
        [int]$Width,
        [int]$Height,
        [string]$BgHex,
        [string]$LogoFile,
        [string]$OutputFile
    )

    $bmp = New-Object System.Drawing.Bitmap($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $color = [System.Drawing.ColorTranslator]::FromHtml($BgHex)
    $g.Clear($color)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $logoPath = Join-Path $publicDir $LogoFile
    $logo = [System.Drawing.Bitmap]::FromFile($logoPath)

    # Logo width: ~50% of screen width, max 480px
    $targetWidth = [int]($Width * 0.48)
    if ($targetWidth -gt 500) { $targetWidth = 500 }
    if ($targetWidth -lt 220) { $targetWidth = 220 }
    $scale = $targetWidth / $logo.Width
    $targetHeight = [int]($logo.Height * $scale)

    $x = [int](($Width - $targetWidth) / 2)
    $y = [int](($Height - $targetHeight) / 2)

    $g.DrawImage($logo, $x, $y, $targetWidth, $targetHeight)

    $logo.Dispose()
    $g.Dispose()

    $outPath = Join-Path $publicDir $OutputFile
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated $OutputFile ($Width x $Height)"
}

$sizes = @(
    @{ Name = "1179x2556"; Width = 1179; Height = 2556 }, # iPhone 15/15 Pro, 16
    @{ Name = "1290x2796"; Width = 1290; Height = 2796 }, # iPhone 15 Plus/Pro Max
    @{ Name = "1170x2532"; Width = 1170; Height = 2532 }, # iPhone 12/13/14
    @{ Name = "1242x2688"; Width = 1242; Height = 2688 }, # iPhone XS Max / 11 Pro Max
    @{ Name = "828x1792";  Width = 828;  Height = 1792 }, # iPhone 11 / XR
    @{ Name = "750x1334";  Width = 750;  Height = 1334 }  # iPhone SE / 8
)

foreach ($s in $sizes) {
    Create-SplashImage -Width $s.Width -Height $s.Height -BgHex "#000000" -LogoFile "byblos-mark-dark.png" -OutputFile "apple-splash-dark-$($s.Name).png"
    Create-SplashImage -Width $s.Width -Height $s.Height -BgHex "#f5f4f0" -LogoFile "byblos-mark-light.png" -OutputFile "apple-splash-light-$($s.Name).png"
}

# Also generate general fallbacks
Create-SplashImage -Width 1179 -Height 2556 -BgHex "#000000" -LogoFile "byblos-mark-dark.png" -OutputFile "apple-splash-dark.png"
Create-SplashImage -Width 1179 -Height 2556 -BgHex "#f5f4f0" -LogoFile "byblos-mark-light.png" -OutputFile "apple-splash-light.png"

Write-Host "All splash screens generated successfully!"
