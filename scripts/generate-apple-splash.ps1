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

    # Logo width: ~48% of screen width, bounded
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
    @{ Name = "1320x2868"; Width = 1320; Height = 2868 }, # iPhone 16 Pro Max (440x956 @3x)
    @{ Name = "1290x2796"; Width = 1290; Height = 2796 }, # iPhone 15/16 Plus, 14/15 Pro Max (430x932 @3x)
    @{ Name = "1284x2778"; Width = 1284; Height = 2778 }, # iPhone 14 Plus, 12/13 Pro Max (428x926 @3x)
    @{ Name = "1206x2622"; Width = 1206; Height = 2622 }, # iPhone 16 Pro (402x874 @3x)
    @{ Name = "1179x2556"; Width = 1179; Height = 2556 }, # iPhone 14/15/16 Pro, 15/16 (393x852 @3x)
    @{ Name = "1170x2532"; Width = 1170; Height = 2532 }, # iPhone 12/13/14 (390x844 @3x)
    @{ Name = "1242x2688"; Width = 1242; Height = 2688 }, # iPhone XS Max, 11 Pro Max (414x896 @3x)
    @{ Name = "828x1792";  Width = 828;  Height = 1792 }, # iPhone 11, XR (414x896 @2x)
    @{ Name = "1125x2436"; Width = 1125; Height = 2436 }, # iPhone X, XS, 11 Pro (375x812 @3x)
    @{ Name = "750x1334";  Width = 750;  Height = 1334 }  # iPhone SE 2/3, 7/8 (375x667 @2x)
)

foreach ($s in $sizes) {
    Create-SplashImage -Width $s.Width -Height $s.Height -BgHex "#000000" -LogoFile "byblos-mark-dark.png" -OutputFile "apple-splash-dark-$($s.Name).png"
    Create-SplashImage -Width $s.Width -Height $s.Height -BgHex "#f5f4f0" -LogoFile "byblos-mark-light.png" -OutputFile "apple-splash-light-$($s.Name).png"
}

# Also generate general fallbacks
Create-SplashImage -Width 1179 -Height 2556 -BgHex "#000000" -LogoFile "byblos-mark-dark.png" -OutputFile "apple-splash-dark.png"
Create-SplashImage -Width 1179 -Height 2556 -BgHex "#f5f4f0" -LogoFile "byblos-mark-light.png" -OutputFile "apple-splash-light.png"

Write-Host "All splash screens generated successfully!"
