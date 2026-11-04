# API REST — `/api/v1`

Erros: `{ "error": { "code", "message", "details?" } }`. Sem stack trace em produção.

## Pública (sem autenticação; somente conteúdo publicado; `Cache-Control: public, s-maxage=300`)

| Método | Rota | Parâmetros |
|---|---|---|
| GET | `/public/settings` | |
| GET | `/public/home` | destaques: 3 notícias, 3 projetos, 3 próximos eventos, processo aberto |
| GET | `/public/news` | `page`, `pageSize` (≤24), `category`, `q` |
| GET | `/public/news/:slug` | |
| GET | `/public/projects` · `/public/projects/:slug` | `category` |
| GET | `/public/events` · `/public/events/:slug` | `when=upcoming\|past\|all`, `category` |
| GET | `/public/team` | |
| GET | `/public/selection-processes` · `/:slug` | detalhe inclui resultados publicados; `registrationUrl` só quando `phase=inscricoes_abertas` |
| GET | `/public/media/:id` | só arquivos `isPublic` |
| GET | `/public/sitemap` | |

## Autenticação

| Método | Rota | Corpo | Notas |
|---|---|---|---|
| POST | `/auth/session` | `{ idToken }` | exige 2º fator, `auth_time` ≤ 5 min, admin ativo, Origin permitido; define cookie `__session`; retorna `csrfToken` |
| GET | `/auth/me` | | usuário, permissões, `csrfToken` |
| POST | `/auth/reauth` | `{ idToken }` | renova identidade para operações sensíveis (10 min); rotaciona a sessão |
| POST | `/auth/logout` | | |

## Administrativa

Todas exigem: cookie de sessão válido, `Origin` na allow-list e header `X-CSRF-Token` (exceto GET). Corpos JSON com schemas estritos (campos desconhecidos → 400).

| Recurso | Rotas | Permissões |
|---|---|---|
| Conteúdo (`news`, `projects`, `events`, `team`, `selection-processes`) | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`, `POST /:id/publish {publishAt?}`, `/unpublish`, `/archive` | read / write / delete / publish. Editar item publicado exige `content:publish` |
| Resultados | `GET/POST /selection-processes/:pid/results`, `PATCH /results/:id`, `POST /results/:id/publish {confirm:true, publishAt?}`, `/unpublish`, `DELETE /results/:id` | results:write / results:publish |
| Mídia | `GET /media`, `POST /media` (multipart: `file`, `isPublic`, `folder`), `PATCH /media/:id`, `PUT /media/:id/file`, `DELETE /media/:id`, `GET /media/:id/file` | media:upload / media:delete |
| Usuários | `GET /users`, `POST /users`, `PATCH /users/:uid/role`, `POST /users/:uid/suspend\|reactivate\|revoke-sessions`, `GET /users/:uid/sessions` | users:manage (+ reautenticação para convite, papel, suspensão) |
| Configurações | `GET /settings`, `PUT /settings` | settings:write |
| Auditoria | `GET /audit?action&actorUid&page` | audit:read |
| Dashboard | `GET /dashboard` | content:read |

## Matriz RBAC

| Permissão | Super Admin | Publicador | Editor |
|---|:-:|:-:|:-:|
| content:read / write, results:write, media:upload | ✓ | ✓ | ✓ |
| content:publish / delete, results:publish, media:delete | ✓ | ✓ | |
| users:manage, settings:write, audit:read, sessions:revoke | ✓ | | |

Ninguém altera o próprio papel, suspende a si mesmo ou reativa a si mesmo.

> Swagger/OpenAPI interativo não foi publicado: a documentação administrativa não deve ficar pública em produção. Esta tabela é a referência; um arquivo OpenAPI pode ser gerado a partir dos schemas Zod como melhoria futura.
