# Deploy (custo zero), backup e resposta a incidentes

Tudo roda em planos gratuitos, **sem cartão de crédito**:

```
Visitante ──HTTPS──► Vercel projeto "latox" (Next.js, raiz web/, região gru1)
                       ├── páginas: SSR/ISR, busca dados na API (+ segredo)
                       └── /api/**  ──middleware (proxy + segredo + IP do visitante)──►
                                    Vercel projeto "latox-api" (Express, raiz functions/, gru1)
                                       ├── Firebase Firestore (Spark) — dados e arquivos
                                       └── Firebase Auth (Spark) — senha; o 2º fator TOTP é verificado pela API

Inscrições ──► Google Forms da liga (Apps Script gera nº de inscrição)
Backups    ──► GitHub Actions semanal, criptografado
```

Limites gratuitos relevantes: Firestore 1 GiB armazenados, 50 mil leituras e 20 mil gravações por dia; Vercel Hobby (uso não comercial), corpo de requisição até 4,5 MB (uploads limitados a 4 MB), 1 cron por dia.

## 1. Firebase (projeto `latox-6684a`, plano Spark)

1. **Firestore** — já criado em `southamerica-east1`. Publicar regras e índices:

```bash
firebase deploy --only firestore --project latox-6684a
```

2. **Authentication** → *Começar* → ativar **E-mail/senha**. Em *Configurações → Domínios autorizados*, adicione o domínio do site no Vercel (ex.: `latox.vercel.app`).
3. *Authentication → Modelos → Redefinição de senha*: ajuste o texto (é o e-mail dos convites).
4. **Conta de serviço** (credencial da API): *Configurações do projeto → Contas de serviço → Gerar nova chave privada*. Baixa um `.json` — **é um segredo**: não envie por chat/e-mail, não coloque no Git. Ele será colado só nas variáveis do Vercel e do GitHub, e o arquivo pode ser apagado depois.
5. No Google Cloud Console → *APIs e serviços → Credenciais*, restrinja a **API key** do app Web por referenciador HTTP ao domínio do site.

## 2. Vercel — projeto da API (`latox-api`)

1. https://vercel.com/new → importe `tulio1057/latox-platform` → nome `latox-api` → **Root Directory: `functions`**. O `functions/vercel.json` já define build, região `gru1` e o cron diário.
2. *Environment Variables* (Production):

| Nome | Valor |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | conteúdo inteiro do `.json` da conta de serviço |
| `ALLOWED_ORIGINS` | URL do site, ex.: `https://latox.vercel.app` (sem barra final) |
| `API_PROXY_SECRET` | segredo A (gerado — ver `vercel-env.local.txt`) |
| `TOTP_ENC_KEY` | segredo B (64 hex). Se perdido, todos recadastram o autenticador |
| `CRON_SECRET` | segredo C |
| `IP_HASH_SALT` | segredo D |

3. Deploy. Teste: `https://latox-api.vercel.app/api/v1/health` → `{"ok":true}`. Qualquer outra rota sem o segredo responde 403 (esperado).

## 3. Vercel — projeto do site (`latox`)

1. Importe o mesmo repositório de novo → nome `latox` → **Root Directory: `web`**.
2. *Environment Variables* (Production):

| Nome | Valor |
|---|---|
| `API_INTERNAL_URL` | `https://latox-api.vercel.app` |
| `API_PROXY_SECRET` | **o mesmo** segredo A |
| `NEXT_PUBLIC_SITE_URL` | `https://latox.vercel.app` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | do app Web do Firebase |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `latox-6684a.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `latox-6684a` |
| `NEXT_PUBLIC_USE_AUTH_EMULATOR` | `false` |

3. Deploy. Se a URL final for diferente de `latox.vercel.app`, atualize `ALLOWED_ORIGINS` (API) e `NEXT_PUBLIC_SITE_URL` (site) e faça *Redeploy* dos dois. Deploys de *preview* não conseguem logar no painel (proteção de origem) — esperado.

## 4. Primeiro Super Admin (sem conta padrão)

Com o `.json` da conta de serviço numa pasta local (fora do repositório):

```bash
cd functions && npm run build && GOOGLE_APPLICATION_CREDENTIALS=/caminho/latox-sa.json FIREBASE_PROJECT_ID=latox-6684a npm run provision-admin -- presidencia@seudominio.org "Nome Completo"
```

O script imprime um link de uso único para a pessoa definir a senha. No primeiro login em `/admin`, ela escaneia o QR code no aplicativo autenticador e recebe 8 códigos de recuperação (guardar offline). Os demais administradores são convidados pelo painel.

## 5. Formulário de inscrição

Ver [integrations/google-forms/README.md](../../integrations/google-forms/README.md).

## 6. Backups

Os backups gerenciados do Firestore exigem faturamento; por isso há um export lógico:

- **Automático**: [`.github/workflows/backup.yml`](../../.github/workflows/backup.yml), toda segunda-feira, criptografado (AES-256/PBKDF2) e guardado 30 dias como artefato do GitHub. Configure em *GitHub → Settings → Secrets and variables → Actions*: `FIREBASE_SERVICE_ACCOUNT` (o `.json`) e `BACKUP_PASSPHRASE` (frase longa, guardada no gerenciador de senhas da liga). Baixe periodicamente um backup para o Drive institucional.
- **Manual** (antes de mudanças grandes):

```bash
cd functions && npm run build && GOOGLE_APPLICATION_CREDENTIALS=/caminho/latox-sa.json FIREBASE_PROJECT_ID=latox-6684a npm run backup -- backup.json
```

- **Restauração** (teste **trimestral** num projeto Firebase de homologação, também Spark):

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in backup.json.enc -out backup.json
```

```bash
cd functions && GOOGLE_APPLICATION_CREDENTIALS=/caminho/latox-hml-sa.json FIREBASE_PROJECT_ID=latox-hml npm run restore -- backup.json --confirm latox-hml
```

Apague `backup.json` descriptografado após o uso.

## 7. Checklist antes de divulgar

- [ ] Textos `[PREENCHER]` substituídos (Admin → Configurações), e-mail e Instagram oficiais.
- [ ] Política de Privacidade revisada pela diretoria.
- [ ] Login + TOTP, convite, publicação, upload, resultado e botão de inscrição testados em produção.
- [ ] Auditoria mostra hashes de IP diferentes para redes diferentes (o IP do visitante chega à API).
- [ ] Secrets do GitHub configurados e um backup executado manualmente (*Actions → Backup semanal → Run workflow*).
- [ ] Uptime check gratuito (ex.: UptimeRobot) no site e em `https://latox-api.vercel.app/api/v1/health`.
- [ ] Revisão de segurança independente / pentest autorizado.

## 8. Resposta a incidentes

1. **Conter**: suspender administradores suspeitos, revogar sessões; se houver suspeita de vazamento, **rotacionar** `API_PROXY_SECRET` (nos dois projetos), `CRON_SECRET` e a chave da conta de serviço (Firebase → Contas de serviço; apague a antiga no Google Cloud IAM). Reverter deploy: Vercel → *Instant Rollback*.
2. **Preservar evidências**: exportar `auditLogs` (backup manual) e logs do Vercel.
3. **Recuperar**: restaurar de backup se houver adulteração (comparar com `contentRevisions`).
4. **Comunicar**: com dados pessoais envolvidos, avaliar comunicação à ANPD e aos titulares (LGPD, art. 48).
5. **Lições aprendidas**: atualizar este documento.
