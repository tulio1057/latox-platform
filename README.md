# LATox — Plataforma institucional

Site oficial e painel administrativo da **Liga Acadêmica de Toxicologia (LATox)**.

| Parte | Tecnologia | Pasta |
|---|---|---|
| Site público + painel `/admin` | Next.js 15 (App Router), React 19, TypeScript | [`web/`](web/) |
| API REST `/api/v1` | Express 5 + TypeScript em Cloud Functions (2ª geração) | [`functions/`](functions/) |
| Banco de dados | Cloud Firestore (acesso só pelo servidor) | regras em [`firestore.rules`](firestore.rules) |
| Arquivos | Cloud Storage (privado, servido pela API) | regras em [`storage.rules`](storage.rules) |
| Autenticação | Firebase Auth / Identity Platform — senha + **TOTP obrigatório** | |
| Hospedagem | Firebase Hosting (Next.js SSR) com rewrite `/api/**` → função | [`firebase.json`](firebase.json) |

Documentação:

- [Arquitetura](docs/architecture/README.md)
- [Modelo de dados (Firestore)](docs/database/README.md)
- [API](docs/api/README.md)
- [Controles de segurança e riscos residuais](docs/security/README.md)
- [Deploy, backup/restauração e resposta a incidentes](docs/deployment/README.md)

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

Terminal 1 — emuladores (Auth, Firestore, Storage, Functions):

```bash
npm --prefix functions run build && FIREBASE_CLI_EXPERIMENTS=webframeworks firebase emulators:start --only auth,firestore,storage,functions --project demo-latox
```

Terminal 2 — dados de desenvolvimento (itens marcados `[DEMO]` + admin local; credenciais gravadas em `functions/.dev-admin.local.txt`, ignorado pelo Git):

```bash
cd functions && FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 GCLOUD_PROJECT=demo-latox npm run seed:dev
```

Terminal 3 — site em http://localhost:3000 (painel em `/admin`):

```bash
npm --prefix web run dev
```

> O emulador de Auth não emite segundo fator TOTP; por isso `DEV_ALLOW_NO_MFA=true` existe **apenas** dentro do emulador de Functions e é ignorado em qualquer outro ambiente.

## Testes

```bash
npm --prefix functions run test:emu
```

```bash
npm --prefix web test
```

API: 42 testes de integração contra os emuladores (autenticação/MFA, sessões, CSRF, RBAC, IDOR, mass assignment, XSS, injeção, uploads maliciosos, resultados, auditoria, rate limit). Web: testes de componentes do redirecionamento de inscrição, links seguros e open redirect.

## Estado do projeto

MVP funcional pronto para homologação. Antes da publicação oficial: preencher os textos `[PREENCHER]` pelo painel, revisar a Política de Privacidade com a diretoria, executar o checklist de deploy e realizar **revisão de segurança independente e teste de invasão autorizado** (ver [docs/security](docs/security/README.md)). Nenhum controle aqui torna o sistema "completamente seguro".
