param(
  [Parameter(Mandatory = $true)]
  [string]$RepoUrl,

  [string]$Branch = "main",
  [string]$CommitMessage = "chore: deploy-ready discloud frontend"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot

try {
  if (-not (Test-Path (Join-Path $projectRoot ".git"))) {
    git init | Out-Null
  }

  $existingOrigin = ""
  try {
    $existingOrigin = (git remote get-url origin 2>$null).Trim()
  } catch {
    $existingOrigin = ""
  }

  if ($existingOrigin) {
    git remote set-url origin $RepoUrl
  } else {
    git remote add origin $RepoUrl
  }

  git add -A
  $hasChanges = (git status --porcelain)
  if ($hasChanges) {
    git commit -m $CommitMessage | Out-Null
  } else {
    Write-Host "Nenhuma alteracao pendente para commit."
  }

  git branch -M $Branch
  git push -u origin $Branch

  Write-Host ""
  Write-Host "Push concluido com sucesso."
  Write-Host "Repositorio: $RepoUrl"
  Write-Host "Branch: $Branch"
  Write-Host ""
} finally {
  Pop-Location
}
