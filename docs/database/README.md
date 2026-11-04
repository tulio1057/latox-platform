# Modelo de dados (Cloud Firestore)

Todas as coleções são acessadas **somente** pela API (regras negam acesso direto). IDs de documentos são aleatórios (20 caracteres, gerados pelo Firestore); a autorização nunca depende de o ID ser difícil de adivinhar.

Estados de conteúdo: `draft` → `published` (com `publishAt`, permite agendamento) → `archived`. Timestamps: `createdAt`, `updatedAt`, `publishedAt`, `publishAt`; autoria: `createdBy`, `updatedBy`, `publishedBy` (uids — nunca expostos pela API pública).

| Coleção | Conteúdo | Observações |
|---|---|---|
| `adminUsers/{uid}` | email, name, role (`SUPER_ADMIN`/`PUBLISHER`/`EDITOR`), status (`active`/`suspended`), mfaEnrolled, totpSecretEnc (cifrado), totpLastStep, recoveryCodeHashes, lastLoginAt | doc id = uid do Firebase Auth |
| `adminSessions/{sha256(id)}` | uid, csrfToken, createdAt, lastSeenAt, expiresAt, reauthAt, userAgent, ipHash | removidos pelo cron diário |
| `mfaChallenges/{sha256(id)}` | uid, purpose, pendingSecretEnc, sessionDocId, attempts, expiresAt | 5 min; cron diário |
| `news` | title, slug, summary, contentHtml, category, coverMediaId, coverAlt, author | |
| `projects` | + descriptionHtml, galleryMediaIds[], responsible[], date, projectStatus | |
| `events` | + startAt, endAt, location, schedule[], speakers[], registrationUrl, eventStatus | |
| `teamMembers` | name, position, group, course, period, bio, link, order, photoMediaId | arquivado = desativado |
| `selectionProcesses` | phase (8 status), registrationStart/End, registrationUrl, noticeMediaId/noticeUrl, requirements[], schedule[], stages[], criteria[], vacancies, documents[] | |
| `selectionResults` | processId, type, title, bodyHtml, entries[{protocol, position, situation}], documentMediaIds[], status, version | **sem** campos de dados pessoais |
| `mediaFiles` | name, kind, mimeType, size, width, height, blobKey, chunkCount, isPublic, folder, uploadedBy | binário em `mediaChunks` |
| `mediaChunks/{blobKey}_{nnn}` | blobKey, index, data (bytes ≤ 900 KB) | só acessível pela API |
| `siteSettings/site` | textos institucionais, contatos, SEO, política de privacidade | |
| `auditLogs` | actorUid, actorEmail, action, resourceType, resourceId, result, meta, ipHash, at | somente inserção |
| `contentRevisions` | resourceType, resourceId, snapshot, reason, by, at | gerado ao alterar conteúdo publicado, substituir resultado, excluir, mudar configurações |
| `rateLimits` | contadores por hash(IP) | removidos pelo cron diário |

Índices: [`firestore.indexes.json`](../../firestore.indexes.json). O plano Spark não tem políticas de TTL; a limpeza de sessões, desafios de MFA e contadores é feita pelo cron diário do Vercel (`/api/v1/internal/cleanup`).

Expansões previstas: coleção `members` (área interna), `categories` dedicadas, integração com plataformas acadêmicas — a estrutura de `contentRouter` aceita novos tipos declarando schema + campos públicos em `lib/content.ts`.
