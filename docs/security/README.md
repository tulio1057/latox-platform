# Controles de segurança

Referências: OWASP Top 10:2025 e OWASP ASVS 5.0. Este documento descreve o que está implementado, como é testado e o que **ainda** é risco. Nada aqui substitui uma revisão independente e um teste de invasão autorizado antes da publicação.

## Implementado

| Ameaça | Controle | Onde | Teste |
|---|---|---|---|
| Acesso não autorizado / Broken Access Control | RBAC no backend em toda rota (`requirePermission`), negação por padrão, menor privilégio | `auth/permissions.ts`, `auth/middleware.ts` | `content.test.ts`, `media-users.test.ts` |
| Elevação de privilégio | ninguém altera o próprio papel; mudanças de papel/suspensão exigem reautenticação e revogam sessões do alvo | `routes/admin/users.ts` | `media-users.test.ts` |
| Editor publicando | publicar/arquivar/excluir exigem `content:publish`/`delete`; editar item publicado é negado a editores | `routes/admin/content.ts` | `content.test.ts` |
| Credential stuffing / brute force | senha verificada pelo Firebase Auth (proteção própria) + MFA TOTP obrigatório + rate limit por IP (memória + compartilhado em Firestore) nos endpoints de sessão | `routes/auth.ts`, `lib/rateLimit.ts` | `auth.test.ts` |
| MFA | sessão só é criada se o ID token tiver `sign_in_second_factor`; não existe opção para desativar no painel | `routes/auth.ts` | `auth.test.ts` |
| Sequestro/fixação de sessão | id de 256 bits, hash no banco, cookie `HttpOnly; Secure; SameSite=Strict`, rotação a cada login/reautenticação, expiração absoluta 8 h e inatividade 1 h, revogação | `auth/session.ts` | `auth.test.ts` |
| CSRF | SameSite=Strict + checagem de `Origin` (allow-list) + token sincronizador por sessão + somente `application/json`/multipart | `auth/middleware.ts`, `app.ts` | `auth.test.ts` |
| XSS armazenado/refletido | sanitização allow-list (`sanitize-html`) de todo HTML antes de gravar; campos texto sem markup; imagens só da própria API; React escapa o resto; CSP | `lib/sanitize.ts`, `next.config.ts` | `content.test.ts` |
| Injeção (NoSQL/"SQL") | Firestore via SDK (sem linguagem de consulta concatenada); validação Zod estrita de tipos | `routes/admin/schemas.ts` | `content.test.ts` |
| Mass assignment | schemas `.strict()`; status/autoria só pelo servidor | `schemas.ts` | `content.test.ts` |
| IDOR / manipulação de IDs | regex de IDs, existência verificada, autorização por papel em todo acesso; público só vê `published` | `content.ts`, `public.ts` | `content.test.ts` |
| Conteúdo não publicado | filtro `status=published && publishAt<=agora` + allow-list de campos | `lib/content.ts` | `content.test.ts` |
| Upload malicioso | extensão permitida + MIME declarado + assinatura (magic bytes) + 4 MB; imagens re-codificadas em WEBP (remove EXIF/GPS e payloads anexados, limite de pixels); PDFs com JavaScript/Launch/EmbeddedFile/XFA recusados; nome gerado no servidor; bucket privado; servido com `nosniff` e CSP `sandbox` | `lib/media.ts`, `routes/admin/media.ts` | `media-users.test.ts` |
| Open redirect | redirecionamento pós-login limitado a `/admin…`; links externos validados (`https`, sem credenciais) | `lib/admin-api.ts`, `lib/fields.ts` | `web/tests` |
| Inscrição externa | link só exibido com status "Inscrições abertas"; `target=_blank rel="noopener noreferrer"`, `referrerpolicy=no-referrer`; nenhum dado na URL; aviso de plataforma externa | `RegistrationCta.tsx` | `web/tests`, `selection.test.ts` |
| SSRF | o servidor nunca busca URLs fornecidas por usuários | — | — |
| Acesso direto à API | segredo compartilhado Vercel→função (`API_PROXY_SECRET`), comparação em tempo constante; sem ele só `/health` responde | `lib/proxy.ts`, `web/middleware.ts` | `proxy.test.ts` |
| Clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` | `next.config.ts`, `app.ts` | verificado no navegador |
| DoS (aplicação) | limites de corpo (512 KB JSON / 4 MB upload), paginação ≤ 50, timeouts da função, `maxInstances`, rate limit | `app.ts`, `index.ts` | `content.test.ts` |
| Vazamento de erros | handler sem stack trace em produção | `lib/errors.ts` | `auth.test.ts` |
| Auditoria | login/logout/falhas, convites, papéis, publicações, exclusões, resultados, uploads, configurações, acessos negados; somente inserção; espelhado no Cloud Logging; filtro que impede gravar campos com nomes de segredo | `lib/audit.ts` | vários |
| Dados de candidatos | resultados só aceitam `protocol/position/situation` | `schemas.ts` | `selection.test.ts` |
| Segredos | nada no Git: `.env*` ignorados, apenas `.env.example`; nenhum admin padrão (provisionamento por script com link de senha de uso único) | `.gitignore`, `scripts/provision-admin.ts` | — |

## Riscos residuais e pendências (honestamente)

1. **CSP com `'unsafe-inline'` em `script-src`** — necessário para a hidratação do Next.js sem nonce por requisição (que impediria cache em CDN). Mitigado pela sanitização no servidor. Melhoria: CSP com nonce via middleware.
2. **Sem antivírus real** nos uploads. A verificação de PDF é heurística (streams comprimidos podem esconder conteúdo). Recomendado: Cloud Run com ClamAV acionado por evento do Storage, ou restringir PDFs a quem tem `media:delete`.
3. **IP de cliente**: em produção vem de `x-real-ip` (definido pelo Vercel) em requisições autenticadas pelo `API_PROXY_SECRET`. Se o segredo vazar, um atacante poderia forjar IPs e contornar o rate limit — rotacione-o. Leituras SSR autenticadas não passam pelo limite por IP (são somente GET públicos com cache).
4. **Rate limit não substitui WAF/anti-DDoS.** Considerar Cloud Armor (via Load Balancer) e App Check.
5. **Passkeys/WebAuthn** não implementados (TOTP apenas).
6. **Recuperação de conta MFA**: se o administrador perder o autenticador, um Super Admin precisa remover o fator pelo Console do Firebase/Identity Platform — procedimento manual que deve ser documentado internamente com verificação de identidade.
7. **Cadastro público no Firebase Auth**: desative "Permitir criação de contas" (Identity Platform › Configurações › Ações do usuário). Mesmo que alguém crie uma conta, ela é rejeitada por não existir em `adminUsers`.
8. **Auditoria no Firestore** não tem encadeamento criptográfico; a proteção contra alteração depende de nenhuma credencial do projeto vazar. O espelho no Cloud Logging deve ter retenção bloqueada (bucket de logs com retention lock).
9. Dependências de desenvolvimento têm avisos `npm audit` moderados (cadeia do ESLint). Rodar `npm audit --omit=dev` antes de cada deploy.
10. **Revisão independente + pentest autorizado** e verificação ASVS nível 2 ainda não realizados.

## Pipeline

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml): typecheck (strict), lint, testes da API nos emuladores, testes do web, build, `npm audit --omit=dev`, varredura de segredos (gitleaks) e análise estática (CodeQL).
