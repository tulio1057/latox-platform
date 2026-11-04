# Arquitetura

```
Navegador ──HTTPS──► Vercel (Next.js, gru1)
                       ├── /api/**  ──middleware proxy + segredo──► Cloud Function "api" (Express, southamerica-east1)
                       │                                              ├── Firestore (Admin SDK)
                       │                                              ├── Cloud Storage (Admin SDK)
                       │                                              └── Firebase Auth (verificação de ID token)
                       └── páginas ─► SSR/ISR, busca /api/v1/public direto na função (com segredo, cache 60 s)

Inscrições ──► Google Forms da liga (Apps Script gera nº de inscrição) — fora do site
```

## Decisões

- **Mesma origem para site e API.** O middleware do Next.js (`web/middleware.ts`) repassa `/api/**` para a função; o navegador só vê o domínio do Vercel, então cookies são `SameSite=Strict`, não há CORS e o CSRF fica restrito.
- **Porta de entrada única.** A função exige o header `x-latox-proxy` com `API_PROXY_SECRET`; chamadas diretas são recusadas (exceto `/health`). O IP do visitante vem de `x-real-ip`, que o Vercel sobrescreve (não pode ser forjado por quem passa pelo site).
- **Firestore e Storage fechados para clientes.** As regras negam tudo; somente a API (Admin SDK) acessa dados. Toda autorização é feita no backend.
- **Sessões no servidor.** O login no navegador usa o SDK do Firebase (senha + TOTP) apenas para obter um ID token de curta duração; a API o verifica (MFA obrigatório, autenticação recente, conta ativa) e cria uma sessão própria: identificador aleatório de 256 bits em cookie HttpOnly, armazenado como hash SHA-256 no Firestore, com token CSRF por sessão, expiração absoluta (8 h) e por inatividade (1 h).
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
- Passkeys/WebAuthn ainda não suportadas — o Firebase Auth não oferece passkeys como segundo fator nativo; o MFA é TOTP.
- Sem antivírus real nos uploads (ver docs/security).
