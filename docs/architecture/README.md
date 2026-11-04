# Arquitetura

```
Navegador ──HTTPS──► Firebase Hosting (CDN)
                       ├── /api/**  ──rewrite──► Cloud Function "api" (Express, southamerica-east1)
                       │                            ├── Firestore (Admin SDK)
                       │                            ├── Cloud Storage (Admin SDK)
                       │                            └── Firebase Auth (verificação de ID token)
                       └── demais rotas ─────────► Next.js SSR (função gerada pelo Hosting)
                                                    └── busca dados públicos em /api/v1/public (cache 60 s)
```

## Decisões

- **Mesma origem para site e API.** O Hosting reescreve `/api/**` para a função, então cookies são `SameSite=Strict`, não há CORS em produção e o CSRF fica restrito. O Hosting só repassa o cookie chamado `__session` — por isso é esse o nome do cookie de sessão.
- **Firestore e Storage fechados para clientes.** As regras negam tudo; somente a API (Admin SDK) acessa dados. Toda autorização é feita no backend.
- **Sessões no servidor.** O login no navegador usa o SDK do Firebase (senha + TOTP) apenas para obter um ID token de curta duração; a API o verifica (MFA obrigatório, autenticação recente, conta ativa) e cria uma sessão própria: identificador aleatório de 256 bits em cookie HttpOnly, armazenado como hash SHA-256 no Firestore, com token CSRF por sessão, expiração absoluta (8 h) e por inatividade (1 h).
- **Conteúdo público projetado.** A API pública devolve apenas campos de uma allow-list e somente itens `published` cuja data de publicação já passou (suporta agendamento).
- **Next.js com ISR.** Páginas públicas são renderizadas no servidor e revalidadas a cada 60 s; falhas da API degradam para estados vazios em vez de erro.
- **Sem pacotes internos compartilhados.** `web/` e `functions/` são pacotes independentes porque o deploy de Functions e do Hosting não resolve dependências de workspace; o contrato é a API documentada.

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
