param(
  [Parameter(Mandatory = $true)]
  [string]$Subdomain,

  [Parameter(Mandatory = $true)]
  [string]$ServerBaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$OwnerId,

  [Parameter(Mandatory = $true)]
  [string]$AppName,

  [Parameter(Mandatory = $true)]
  [string]$SellerKey,

  [string]$DisplayName = "Painel KeyAuth FreeFire",
  [string]$PackageName = "painel-keyauth-freefire",
  [string]$KeyAuthVersion = "1.0",
  [string]$KeyAuthHash = "",
  [string]$OutputZip = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Subdomain {
  param([string]$Value)

  if ($Value.Length -gt 20) {
    throw "Subdominio invalido: maximo de 20 caracteres."
  }

  if ($Value -notmatch "^[a-zA-Z0-9-]+$") {
    throw "Subdominio invalido: use apenas letras, numeros e hifen."
  }
}

function Normalize-BaseUrl {
  param([string]$Value)

  $trimmed = $Value.Trim()
  if (-not $trimmed) {
    throw "ServerBaseUrl nao pode estar vazio."
  }

  if ($trimmed -notmatch "^https?://") {
    throw "ServerBaseUrl deve comecar com http:// ou https://"
  }

  return $trimmed.TrimEnd("/")
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$exportsRoot = Join-Path (Split-Path -Parent $projectRoot) "exports"

Ensure-Subdomain -Value $Subdomain
$base = Normalize-BaseUrl -Value $ServerBaseUrl

$bridgeUrl = "$base/api/desktop/"
$apiUrl = "$base/api/1.2/"

$discloudConfig = @(
  "NAME=$DisplayName"
  "TYPE=site"
  "ID=$Subdomain"
  "MAIN=server.js"
  "RAM=512"
  "VERSION=latest"
  "START=node server.js"
)
Set-Content -Path (Join-Path $projectRoot "discloud.config") -Value $discloudConfig -Encoding UTF8

$envFile = @(
  "KEYAUTH_BRIDGE_URL=$bridgeUrl"
  "KEYAUTH_API_URL=$apiUrl"
  "KEYAUTH_OWNER_ID=$OwnerId"
  "KEYAUTH_APP_NAME=$AppName"
  "KEYAUTH_SELLER_KEY=$SellerKey"
  "KEYAUTH_VERSION=$KeyAuthVersion"
  "KEYAUTH_HASH=$KeyAuthHash"
)
Set-Content -Path (Join-Path $projectRoot ".env") -Value $envFile -Encoding UTF8

$pkgPath = Join-Path $projectRoot "package.json"
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
$pkg.name = $PackageName
($pkg | ConvertTo-Json -Depth 15) + "`r`n" | Set-Content -Path $pkgPath -Encoding UTF8

if (-not $OutputZip) {
  if (-not (Test-Path $exportsRoot)) {
    New-Item -Path $exportsRoot -ItemType Directory | Out-Null
  }
  $OutputZip = Join-Path $exportsRoot "discloud-keyauth-frontend.zip"
}

if (Test-Path $OutputZip) {
  Remove-Item $OutputZip -Force
}

Compress-Archive -Path (Join-Path $projectRoot "*") -DestinationPath $OutputZip -Force

Write-Host ""
Write-Host "Pronto. Arquivos preparados com sucesso."
Write-Host "discloud.config => ID=$Subdomain"
Write-Host ".env => BRIDGE=$bridgeUrl"
Write-Host ".env => API=$apiUrl"
Write-Host "ZIP => $OutputZip"
Write-Host ""
