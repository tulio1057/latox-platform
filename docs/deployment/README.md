# Deploy, backup e resposta a incidentes

Topologia de produção:

```
Visitante ──HTTPS──► Vercel (Next.js, região gru1/São Paulo)
                       ├── páginas: SSR/ISR, busca dados em API_INTERNAL_URL (+ segredo)
                       └── /api/**  ──middleware (proxy + segredo)──► Firebase Cloud Function "api"
                                                                        (southamerica-east1)
                                                                        ├── Firestore
                                                                        ├── Cloud Storage
                                                                        └── Firebase Auth
```

O navegador só conversa com o domínio do Vercel. O cookie de sessão continua first-party (`SameSite=Strict`) e a API recusa chamadas sem o segredo `API_PROXY_SECRET`, então ninguém consegue chamá-la diretamente por fora do site.

## 1. Firebase (banco, arquivos, autenticação e API)

1. Crie o projeto em https://console.firebase.google.com (ex.: `latox-prod`). Para homologação, crie outro (`latox-hml`).
2. **Plano Blaze** (Uso e faturamento → Modificar plano). Exigido por Cloud Functions e Storage. Configure um **alerta de orçamento** (ex.: R$ 20/mês) em console.cloud.google.com/billing → Orçamentos e alertas.
3. **Authentication → Começar → E-mail/senha** ativado. Depois **Configurações → "Fazer upgrade para o Identity Platform"**.
4. Em *Authentication → Configurações → Ações do usuário*: **desmarque "Permitir criação"** (sem cadastro público).
5. Ative o segundo fator **TOTP** (não há botão no console). No terminal, com uma conta de proprietário do projeto:

```bash
gcloud auth login
```

```bash
curl -X PATCH "https://identitytoolkit.googleapis.com/admin/v2/projects/PROJECT_ID/config?updateMask=mfa" -H "Authorization: Bearer $(gcloud auth print-access-token)" -H "Content-Type: application/json" -H "X-Goog-User-Project: PROJECT_ID" -d '{"mfa":{"state":"ENABLED","providerConfigs":[{"state":"ENABLED","totpProviderConfig":{"adjacentIntervals":1}}]}}'
```

6. *Authentication → Configurações → Domínios autorizados*: adicione o domínio do Vercel (ex.: `latox.vercel.app`) e o domínio próprio, se houver.
7. **Firestore Database → Criar** (modo produção, local `southamerica-east1`). **Storage → Começar** (mesma região).
8. *Configurações do projeto → Seus apps → Web (`</>`)*: registre um app e anote `apiKey`, `authDomain`, `projectId`. No Google Cloud Console → *APIs e serviços → Credenciais*, restrinja essa API key por **referenciador HTTP** ao domínio do site.
9. *Authentication → Modelos → Redefinição de senha*: ajuste o texto (é o e-mail usado nos convites de administradores).

### Variáveis da API

Crie `functions/.env.PROJECT_ID` (não vai para o Git). Gere os dois segredos uma vez e guarde-os num gerenciador de senhas:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```
ALLOWED_ORIGINS=https://latox.vercel.app
API_PROXY_SECRET=<segredo 1 — o MESMO valor vai para o Vercel>
IP_HASH_SALT=<segredo 2>
TRUST_PROXY_HOPS=1
LATOX_REGION=southamerica-east1
```

> `ALLOWED_ORIGINS` precisa conter exatamente a URL pela qual as pessoas acessam o painel (sem barra no final). Deploys de *preview* do Vercel têm outra URL e, por segurança, não conseguem fazer login no painel.

### Deploy da API, regras e índices

```bash
firebase login
```

```bash
firebase use --add
```

```bash
firebase deploy --only functions,firestore,storage
```

A URL da função aparece no fim do deploy, no formato `https://southamerica-east1-PROJECT_ID.cloudfunctions.net/api`. Teste:

```bash
curl https://southamerica-east1-PROJECT_ID.cloudfunctions.net/api/api/v1/health
```

Deve responder `{"ok":true}`. Qualquer outra rota sem o segredo responde 403 (esperado).

Depois do primeiro deploy, confirme no console: índices criados e políticas TTL ativas (`adminSessions.expiresAt`, `rateLimits.expireAt`).

## 2. Vercel (site e painel)

1. Em https://vercel.com/new importe o repositório `tulio1057/latox-platform`.
2. **Root Directory: `web`**. Framework: Next.js (detectado).
3. **Environment Variables** (Production):

| Nome | Valor |
|---|---|
| `API_INTERNAL_URL` | `https://southamerica-east1-PROJECT_ID.cloudfunctions.net/api` |
| `API_PROXY_SECRET` | segredo 1 (o mesmo da API) — **sem** prefixo `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | `https://latox.vercel.app` (ou o domínio próprio) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | do app Web do Firebase |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `PROJECT_ID.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `PROJECT_ID` |
| `NEXT_PUBLIC_USE_AUTH_EMULATOR` | `false` |

4. **Deploy**. A cada push na `main`, o Vercel publica de novo automaticamente.
5. Domínio próprio (opcional): *Settings → Domains*. Depois atualize `NEXT_PUBLIC_SITE_URL`, `ALLOWED_ORIGINS` (e refaça o deploy da API) e os domínios autorizados do Firebase Auth.

## 3. Primeiro Super Admin (sem conta padrão)

```bash
gcloud auth application-default login
```

```bash
cd functions && npm run build && GCLOUD_PROJECT=PROJECT_ID npm run provision-admin -- presidencia@seudominio.org "Nome Completo"
```

O script imprime um link de uso único para definir a senha. No primeiro login em `/admin`, o sistema exige configurar o aplicativo autenticador (TOTP). Os demais administradores são convidados pelo painel.

## 4. Formulário de inscrição

Siga [integrations/google-forms/README.md](../../integrations/google-forms/README.md): o script cria o Google Forms (nome, e-mail, curso, período), gera números de inscrição e você cola o link no processo seletivo pelo painel.

## 5. Checklist antes de divulgar

- [ ] Textos `[PREENCHER]` substituídos (Admin → Configurações), e-mail e Instagram oficiais.
- [ ] Política de Privacidade revisada pela diretoria (a versão-base já descreve Vercel, Firebase e Google Forms).
- [ ] `npm audit --omit=dev` sem vulnerabilidades altas em `functions/` e `web/`.
- [ ] Teste em produção: login + TOTP, convite, publicação, upload, resultado, botão de inscrição abrindo o Forms.
- [ ] Conferir no log de auditoria que o hash de IP muda entre redes diferentes (confirma que o IP do visitante chega via `x-real-ip`).
- [ ] Alertas de orçamento e de disponibilidade configurados.
- [ ] Backup agendado e **um restore testado**.
- [ ] Revisão de segurança independente / pentest autorizado.

## 6. Backup e restauração

Backups agendados nativos do Firestore (diários, 14 semanas):

```bash
gcloud firestore backups schedules create --database="(default)" --recurrence=daily --retention=14w --project PROJECT_ID
```

Exportação manual (antes de mudanças grandes):

```bash
gcloud firestore export gs://PROJECT_ID-backups/$(date +%F) --project PROJECT_ID
```

Storage: ative *Object Versioning* e *Soft delete* (≥ 7 dias) no bucket de mídia. Logs de auditoria: bucket do Cloud Logging com retenção de 5 anos e *retention lock*.

Restauração (testar **trimestralmente** no projeto de homologação):

```bash
gcloud firestore import gs://PROJECT_ID-backups/AAAA-MM-DD --project latox-hml
```

Respostas do Google Forms: a planilha fica no Drive da liga (versionamento do próprio Google). Não exporte cópias para fora da conta institucional.

## 7. Monitoramento

- Uptime check (Cloud Monitoring ou UptimeRobot) em `https://SEU-SITE/` e `https://southamerica-east1-PROJECT_ID.cloudfunctions.net/api/api/v1/health`.
- Alertas por log: falhas repetidas de `auth.login`, qualquer `user.role_change`, `user.invite`, `result.replace`, erros 5xx.
- Vercel: *Observability/Logs* para o site.
- Dependabot/Renovate para dependências.

## 8. Resposta a incidentes

1. **Conter**: suspender administradores suspeitos, revogar sessões, **rotacionar `API_PROXY_SECRET`** (API e Vercel) se houver suspeita de vazamento, reverter o deploy (Vercel: *Instant Rollback*; Functions: redeploy do commit anterior).
2. **Preservar evidências**: exportar `auditLogs` e logs do período.
3. **Erradicar e recuperar**: corrigir a causa; restaurar do backup se houver adulteração (comparar com `contentRevisions`).
4. **Comunicar**: com dados pessoais envolvidos, avaliar comunicação à ANPD e aos titulares (LGPD, art. 48).
5. **Lições aprendidas**: atualizar este documento.
