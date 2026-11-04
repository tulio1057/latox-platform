# LATox — Plataforma institucional

Site oficial e painel administrativo da **Liga Acadêmica de Toxicologia (LATox)**.

| Parte | Tecnologia | Pasta |
|---|---|---|
| Site público + painel `/admin` | Next.js 15 (App Router), React 19, TypeScript | [`web/`](web/) |
| API REST `/api/v1` | Express 5 + TypeScript em Vercel Functions (projeto separado) | [`functions/`](functions/) |
| Banco de dados | Cloud Firestore (acesso só pelo servidor) | regras em [`firestore.rules`](firestore.rules) |
| Arquivos | No Firestore, em pedaços de 900 KB, servidos só pela API (o plano gratuito não tem Storage) | `functions/src/lib/blobStore.ts` |
| Autenticação | Firebase Auth (senha) + **TOTP obrigatório verificado pela API** | `functions/src/auth/` |
| Hospedagem | **Vercel** (site + API, região São Paulo), Firebase no plano **Spark** — custo zero | [`web/middleware.ts`](web/middleware.ts), [`firebase.json`](firebase.json) |
| Inscrições | Google Forms criado por Apps Script, com nº de inscrição | [`integrations/google-forms/`](integrations/google-forms/) |

Documentação:

- [Arquitetura](docs/architecture/README.md)
- [Modelo de dados (Firestore)](docs/database/README.md)
- [API](docs/api/README.md)
- [Controles de segurança e riscos residuais](docs/security/README.md)
- [Deploy (Vercel + Firebase), backup/restauração e resposta a incidentes](docs/deployment/README.md)
- [Formulário de inscrição no Google Forms](integrations/google-forms/README.md)

## Desenvolvimento local

Pré-requisitos: Node.js 22, Firebase CLI ≥ 15, **Java 21** (emuladores).

```bash
npm --prefix functions install
```

```bash
npm --prefix web install
```

```bash
cp functions/.env.example functions/.env.local && cp web/.env.example web/.env.local
```

Terminal 1 — emuladores (Auth, Firestore):

```bash
firebase emulators:start --only auth,firestore --project demo-latox
```

Terminal 2 — dados de desenvolvimento (itens marcados `[DEMO]` + admin local; credenciais gravadas em `functions/.dev-admin.local.txt`, ignorado pelo Git):

```bash
cd functions && FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 GCLOUD_PROJECT=demo-latox npm run seed:dev
```

Terminal 3 — API em http://localhost:8787:

```bash
npm --prefix functions run dev
```

Terminal 4 — site em http://localhost:3000 (painel em `/admin`):

```bash
npm --prefix web run dev
```

> No primeiro login local, escaneie o QR code com qualquer app autenticador: o TOTP é verificado pela própria API, inclusive com os emuladores.

## Testes

```bash
npm --prefix functions run test:emu
```

```bash
npm --prefix web test
```

API: 54 testes de integração contra os emuladores (autenticação/MFA, sessões, CSRF, RBAC, IDOR, mass assignment, XSS, injeção, uploads maliciosos, resultados, auditoria, rate limit, proteção do proxy, MFA: reuso de código, força bruta, recuperação, redefinição). Web: testes de componentes do redirecionamento de inscrição, links seguros e open redirect.

## Estado do projeto

MVP funcional pronto para homologação. Antes da publicação oficial: preencher os textos `[PREENCHER]` pelo painel, revisar a Política de Privacidade com a diretoria, executar o checklist de deploy e realizar **revisão de segurança independente e teste de invasão autorizado** (ver [docs/security](docs/security/README.md)). Nenhum controle aqui torna o sistema "completamente seguro".
