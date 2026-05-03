# Painel KeyAuth (Discloud)

Frontend com:
- landing page
- painel web para gerar key no KeyAuth
- validacao online de key (`init + license`)

## Setup automatico (recomendado)

Execute na pasta do projeto:

```powershell
.\tools\prepare-discloud.ps1 `
  -Subdomain "seu-subdominio" `
  -ServerBaseUrl "https://seu-dominio.com/keyauth-source" `
  -OwnerId "SEU_OWNER_ID" `
  -AppName "SEU_APP_NAME" `
  -SellerKey "SEU_SELLER_KEY"
```

Esse comando:
- atualiza `discloud.config`
- cria `.env`
- ajusta o nome do `package.json`
- gera o zip pronto em `../exports/discloud-keyauth-frontend.zip`

## Deploy Discloud

1. Registre o subdominio no painel Discloud.
2. Rode o script acima.
3. Envie o zip gerado no upload da Discloud.

## Publicar no GitHub

```powershell
.\tools\publish-github.ps1 -RepoUrl "https://github.com/SEU_USUARIO/SEU_REPO.git"
```

## Variaveis opcionais no script

- `-DisplayName "Nome do app no painel"`
- `-PackageName "nome-do-pacote"`
- `-KeyAuthVersion "1.0"`
- `-KeyAuthHash "HASH_OPCIONAL"`
- `-OutputZip "C:\caminho\arquivo.zip"`

## Rotas

- `/`
- `/panel`
- `/api/generate-key`
- `/api/validate-key`
- `/api/config-status`
