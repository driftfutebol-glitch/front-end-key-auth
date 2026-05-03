# Vercel KeyAuth Frontend

Frontend pronto para Vercel com:
- landing page
- painel web para gerar key no KeyAuth (via serverless API)
- validacao online de key (`init + license`)

## Deploy

1. Suba esta pasta no Vercel.
2. Configure variaveis de ambiente do projeto usando `.env.example`.
3. Deploy.

## Variaveis obrigatorias

- `KEYAUTH_BRIDGE_URL`
- `KEYAUTH_API_URL`
- `KEYAUTH_OWNER_ID`
- `KEYAUTH_APP_NAME`
- `KEYAUTH_SELLER_KEY`

## Variaveis opcionais

- `KEYAUTH_VERSION` (padrao: `1.0`)
- `KEYAUTH_HASH` (use se seu app tiver hashcheck ativo)

## Rotas

- `/` landing
- `/panel` painel
- `/api/generate-key` serverless para gerar key no backend
- `/api/validate-key` serverless para validar key online
- `/api/config-status` status de configuracao
