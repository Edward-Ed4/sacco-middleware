$keysDir = "C:\Users\Edward\Desktop\Project\infra\besu\qbft-config\networkFiles\keys"
$dirs = @(Get-ChildItem $keysDir -Directory)

for ($i = 0; $i -lt 4; $i++) {
    $src  = Join-Path $dirs[$i].FullName "key"
    $dest = "C:\Users\Edward\Desktop\Project\infra\besu\validator$($i+1)\key"
    Copy-Item $src $dest -Force
    Write-Host "validator$($i+1) <- $($dirs[$i].Name)"
}

Write-Host "Keys copied successfully"
