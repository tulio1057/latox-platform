# Arquitetura

```
Navegador ──HTTPS──► Vercel (Next.js, gru1)
                       ├── /api/**  ──middleware proxy + segredo──► Vercel "latox-api" (Express, gru1)
                       │                                              ├── Firestore (Admin SDK)
                       │                                              ├── arquivos em pedaços no Firestore
                       │                                              └── Firebase Auth (senha) + TOTP verificado pela API
                       └── páginas ─► SSR/ISR, busca /api/v1/public direto na função (com segredo, cache 60 s)

Inscrições ──► Google Forms da liga (Apps Script gera nº de inscrição) — fora do site
```

## Decisões

- **Mesma origem para site e API.** O middleware do Next.js (`web/middleware.ts`) repassa `/api/**` para a função; o navegador só vê o domínio do Vercel, então cookies são `SameSite=Strict`, não há CORS e o CSRF fica restrito.
- **Porta de entrada única.** A função exige o header `x-latox-proxy` com `API_PROXY_SECRET`; chamadas diretas são recusadas (exceto `/health`). O IP do visitante vem de `x-real-ip`, que o Vercel sobrescreve (não pode ser forjado por quem passa pelo site).
- **Custo zero.** Firebase no plano Spark (sem Cloud Functions/Storage) e dois projetos Vercel Hobby. Arquivos ficam no Firestore divididos em pedaços de 900 KB (`lib/blobStore.ts`), servidos só pela API.
- **Firestore fechado para clientes.** As regras negam tudo; somente a API (Admin SDK) acessa dados. Toda autorização é feita no backend.
- **Sessões no servidor e MFA na API.** O navegador valida a senha no Firebase Auth e envia o ID token (curta duração) à API, que exige autenticação recente e conta ativa e então pede o segundo fator: código TOTP de app autenticador (biblioteca `otpauth`, segredo cifrado com AES-256-GCM, proteção contra reuso, 5 tentativas por desafio) ou código de recuperação de uso único. Só então cria a sessão: identificador aleatório de 256 bits em cookie HttpOnly, guardado como hash SHA-256, com token CSRF, expiração absoluta (8 h) e por inatividade (1 h).
- **Conteúdo público projetado.** A API pública devolve apenas campos de uma allow-list e somente itens `published` cuja data de publicação já passou (suporta agendamento).
- **Next.js com ISR.** Páginas públicas são renderizadas no servidor e revalidadas a cada 60 s; falhas da API degradam para estados vazios em vez de erro.
- **Sem pacotes internos compartilhados.** `web/` (Vercel, Root Directory `web`) e `functions/` (Firebase) são implantados separadamente; o contrato é a API documentada.
- **Uploads até 4 MB**, para caber no limite de requisição do proxy do Vercel. Editais maiores entram como link externo.

## Módulos da API (`functions/src`)

| Módulo | Arquivo |
|---|---|
| Autenticação / sessões | `routes/auth.ts`, `auth/session.ts`, `auth/middleware.ts` |
| RBAC | `auth/permissions.ts` |
| Notícias, Projetos, Eventos, Equipe, Processos seletivos | `routes/admin/content.ts` (CRUD genérico) + `routes/admin/schemas.ts` |
| Resultados | `routes/admin/results.ts` |
| Mídia | `routes/admin/media.ts`, `lib/media.ts` |
| Usuários | `routes/admin/users.ts` |
| Configurações, auditoria, dashboard | `routes/admin/misc.ts`, `lib/settings.ts`, `lib/audit.ts` |
| API pública | `routes/public.ts` |

## Limitações conhecidas do MVP

- Listagens e busca de notícias carregam até 1000 itens publicados e filtram em memória (Firestore não tem busca textual). Suficiente para o volume de uma liga; acima disso, migrar para índice de busca (ex.: Algolia/Typesense) ou paginação por cursor.
- Categorias são texto livre por conteúdo (não há coleção dedicada).
- Passkeys/WebAuthn ainda não suportadas; o MFA é TOTP (app autenticador) com códigos de recuperação.
- Firestore gratuito: 1 GiB, 50 mil leituras/20 mil gravações por dia. Respostas públicas e arquivos são cacheados pela CDN do Vercel para economizar leituras.
- Sem antivírus real nos uploads (ver docs/security).
