# Deploy, backup e resposta a incidentes

## 1. Projetos e ambientes

Crie **dois** projetos Firebase separados: `latox-hml` (homologação) e `latox-prod` (produção). Ambos no plano **Blaze** (obrigatório para Cloud Functions e SSR). Região: `southamerica-east1`.

```bash
firebase login
```

```bash
firebase use --add
```

## 2. Configuração do console (cada projeto)

1. **Authentication → Fazer upgrade para Identity Platform** (necessário para MFA).
2. Provedor **E-mail/senha** ativado. Em *Configurações → Ações do usuário*, **desative a criação de contas** (sign-up) e a exclusão pelo usuário.
3. Ative o **TOTP** como segundo fator (não há botão no console; use a API REST com uma conta de proprietário):

```bash
curl -X PATCH "https://identitytoolkit.googleapis.com/admin/v2/projects/PROJECT_ID/config?updateMask=mfa" -H "Authorization: Bearer $(gcloud auth print-access-token)" -H "Content-Type: application/json" -H "X-Goog-User-Project: PROJECT_ID" -d '{"mfa":{"state":"ENABLED","providerConfigs":[{"state":"ENABLED","totpProviderConfig":{"adjacentIntervals":1}}]}}'
```

4. *Authentication → Configurações → Domínios autorizados*: apenas o domínio do site (remova `localhost` em produção).
5. **Firestore** em modo nativo, região `southamerica-east1`. **Storage** com bucket padrão.
6. Google Cloud Console → *APIs e serviços → Credenciais*: restrinja a API key web por referenciador HTTP (domínio do site).
7. Personalize o e-mail de redefinição de senha (Authentication → Modelos) — ele é usado nos convites.

## 3. Variáveis de ambiente (não versionadas)

`functions/.env.<project-id>`:

```
ALLOWED_ORIGINS=https://latox-prod.web.app,https://www.seudominio.org
IP_HASH_SALT=<openssl rand -hex 32>
TRUST_PROXY_HOPS=1
LATOX_REGION=southamerica-east1
```

`web/.env.production` (valores públicos, exceto API_INTERNAL_URL que é server-side):

```
API_INTERNAL_URL=https://latox-prod.web.app
NEXT_PUBLIC_SITE_URL=https://www.seudominio.org
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=latox-prod.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=latox-prod
NEXT_PUBLIC_USE_AUTH_EMULATOR=false
```

**Nunca** defina `DEV_ALLOW_NO_MFA` fora do `.env.local` de desenvolvimento (e mesmo lá ele só funciona dentro do emulador).

## 4. Deploy

```bash
firebase use latox-hml
```

```bash
FIREBASE_CLI_EXPERIMENTS=webframeworks firebase deploy --only firestore,storage,functions,hosting
```

Depois do primeiro deploy, confirme no console: índices criados, políticas TTL ativas (`adminSessions.expiresAt`, `rateLimits.expireAt`), função `api` com invocação pública (o Hosting precisa chamá-la).

## 5. Primeiro Super Admin (sem conta padrão)

Em uma máquina confiável, com credenciais do Google Cloud:

```bash
gcloud auth application-default login
```

```bash
cd functions && npm run build && GCLOUD_PROJECT=latox-hml npm run provision-admin -- presidencia@seudominio.org "Nome Completo"
```

O script imprime um link de uso único para definir a senha. Entregue por canal confiável. No primeiro login, o sistema exige configurar o autenticador (TOTP). Demais administradores são convidados pelo painel.

## 6. Checklist antes de ir para produção

- [ ] Textos `[PREENCHER]` substituídos pelo painel (Configurações).
- [ ] Política de Privacidade revisada pela diretoria e publicada (Configurações → Privacidade).
- [ ] E-mail institucional e Instagram oficiais preenchidos.
- [ ] `npm audit --omit=dev` sem vulnerabilidades altas em `functions/` e `web/`.
- [ ] Teste em homologação: login + TOTP, convite, publicação, resultado, upload, revogação de sessão.
- [ ] Validar `TRUST_PROXY_HOPS` (registrar `req.ips` em homologação).
- [ ] Alertas configurados (seção 8).
- [ ] Backups agendados e **um restore testado** (seção 7).
- [ ] Revisão de segurança independente e pentest autorizado.

## 7. Backup e restauração

Firestore — exportação diária criptografada (chaves gerenciadas pelo Google; use CMEK se exigido) para um bucket dedicado, em outro projeto ou com acesso restrito:

```bash
gsutil mb -l southamerica-east1 -b on gs://latox-prod-backups
```

```bash
gcloud firestore export gs://latox-prod-backups/$(date +%F) --project latox-prod
```

Agende com Cloud Scheduler → Cloud Workflows/Function (ou habilite **Firestore PITR** de 7 dias + **backups agendados** nativos: `gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=14w`).

Storage — habilite *Object Versioning* e *Soft delete* (≥ 7 dias) no bucket de mídia; opcionalmente replique com Storage Transfer Service.

Retenção sugerida: diários por 14 semanas; mensais por 1 ano. Logs de auditoria: bucket de Cloud Logging com retenção de 5 anos e *retention lock*.

Restauração (testar **trimestralmente** em `latox-hml`):

```bash
gcloud firestore import gs://latox-prod-backups/AAAA-MM-DD --project latox-hml
```

Registre data, duração e resultado de cada teste de restauração.

## 8. Monitoramento e alertas

- Cloud Monitoring: uptime check em `/api/v1/health` e na página inicial.
- Alertas por log (Logs Explorer → métrica baseada em log): `jsonPayload.message="audit" AND jsonPayload.action="auth.login" AND jsonPayload.result!="success"` acima de N/5 min; qualquer `user.role_change`, `user.invite`, `result.replace`; erros 5xx.
- Budget alert no faturamento (proteção contra abuso de custo).
- Dependabot/Renovate para atualizações de dependências.

## 9. Resposta a incidentes (resumo)

1. **Conter**: suspender administradores suspeitos (painel ou `adminUsers/{uid}.status=suspended`), revogar sessões, rotacionar `IP_HASH_SALT` se necessário, desativar a função `api` (rollback do Hosting: `firebase hosting:rollback`).
2. **Preservar evidências**: exportar `auditLogs` e logs do Cloud Logging do período.
3. **Erradicar e recuperar**: corrigir causa, restaurar dados a partir de backup se houver adulteração (comparar com `contentRevisions`).
4. **Comunicar**: se houver dados pessoais envolvidos, avaliar comunicação à ANPD e aos titulares (LGPD, art. 48) com a diretoria.
5. **Lições aprendidas**: registrar e atualizar este documento.
