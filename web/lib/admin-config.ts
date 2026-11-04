export type Permission =
  | "content:read"
  | "content:write"
  | "content:publish"
  | "content:delete"
  | "results:write"
  | "results:publish"
  | "media:upload"
  | "media:delete"
  | "users:manage"
  | "settings:write"
  | "audit:read"
  | "sessions:revoke";

export type Role = "SUPER_ADMIN" | "PUBLISHER" | "EDITOR";
export const ROLE_LABELS: Record<Role, string> = { SUPER_ADMIN: "Super Admin", PUBLISHER: "Publicador", EDITOR: "Editor" };

export interface Me {
  uid: string;
  email: string | null;
  name: string;
  role: Role;
  permissions: Permission[];
}

export type FieldKind =
  | "text"
  | "textarea"
  | "rich"
  | "select"
  | "date"
  | "datetime"
  | "number"
  | "url"
  | "media"
  | "mediaList"
  | "stringList"
  | "objectList";

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  help?: string;
  max?: number;
  options?: { value: string; label: string }[];
  mediaKind?: "image" | "pdf";
  itemFields?: FieldDef[];
  /** Empty value is sent as null (schema field is nullable). */
  nullable?: boolean;
}

export interface ContentTypeConfig {
  key: string;
  api: string;
  label: string;
  singular: string;
  titleField: string;
  publicPath?: (slug: string) => string;
  fields: FieldDef[];
  defaults: Record<string, unknown>;
}

const opt = (o: Record<string, string>) => Object.entries(o).map(([value, label]) => ({ value, label }));

export const PHASES = opt({
  em_breve: "Em breve",
  inscricoes_abertas: "Inscrições abertas",
  inscricoes_encerradas: "Inscrições encerradas",
  em_analise: "Em análise",
  resultado_preliminar: "Resultado preliminar publicado",
  periodo_recursos: "Período de recursos",
  resultado_final: "Resultado final publicado",
  finalizado: "Processo finalizado",
});

export const RESULT_TYPES = opt({
  preliminar: "Resultado preliminar",
  final: "Resultado final",
  aprovados: "Lista de aprovados",
  classificados: "Lista de classificados",
  comunicado: "Comunicado",
});

const cover: FieldDef[] = [
  { name: "coverMediaId", label: "Imagem de capa", kind: "media", mediaKind: "image", nullable: true },
  { name: "coverAlt", label: "Texto alternativo da capa", kind: "text", max: 200, help: "Descreva a imagem para leitores de tela." },
];

export const CONTENT_TYPES: Record<string, ContentTypeConfig> = {
  noticias: {
    key: "noticias",
    api: "news",
    label: "Notícias",
    singular: "notícia",
    titleField: "title",
    publicPath: (s) => `/noticias/${s}`,
    defaults: { title: "", summary: "", contentHtml: "", category: "", author: "" },
    fields: [
      { name: "title", label: "Título", kind: "text", required: true, max: 200 },
      { name: "slug", label: "URL amigável (slug)", kind: "text", max: 80, help: "Gerado automaticamente a partir do título se vazio." },
      { name: "summary", label: "Resumo", kind: "textarea", max: 500 },
      { name: "category", label: "Categoria", kind: "text", max: 60 },
      { name: "author", label: "Autor ou responsável", kind: "text", max: 120 },
      ...cover,
      { name: "contentHtml", label: "Conteúdo", kind: "rich" },
    ],
  },
  projetos: {
    key: "projetos",
    api: "projects",
    label: "Projetos",
    singular: "projeto",
    titleField: "title",
    publicPath: (s) => `/projetos/${s}`,
    defaults: { title: "", summary: "", descriptionHtml: "", category: "", projectStatus: "em_andamento", responsible: [], galleryMediaIds: [] },
    fields: [
      { name: "title", label: "Título", kind: "text", required: true, max: 200 },
      { name: "slug", label: "URL amigável (slug)", kind: "text", max: 80 },
      { name: "summary", label: "Descrição curta", kind: "textarea", max: 500 },
      { name: "category", label: "Categoria", kind: "text", max: 60, help: "Ex.: Ensino, Pesquisa, Extensão." },
      { name: "projectStatus", label: "Status do projeto", kind: "select", options: opt({ planejado: "Planejado", em_andamento: "Em andamento", concluido: "Concluído" }) },
      { name: "date", label: "Data", kind: "date", nullable: true },
      { name: "responsible", label: "Responsáveis", kind: "stringList" },
      ...cover,
      { name: "galleryMediaIds", label: "Galeria de imagens", kind: "mediaList", mediaKind: "image" },
      { name: "descriptionHtml", label: "Descrição completa", kind: "rich" },
    ],
  },
  eventos: {
    key: "eventos",
    api: "events",
    label: "Eventos",
    singular: "evento",
    titleField: "title",
    publicPath: (s) => `/eventos/${s}`,
    defaults: { title: "", summary: "", descriptionHtml: "", category: "", location: "", eventStatus: "agendado", schedule: [], speakers: [] },
    fields: [
      { name: "title", label: "Nome do evento", kind: "text", required: true, max: 200 },
      { name: "slug", label: "URL amigável (slug)", kind: "text", max: 80 },
      { name: "summary", label: "Resumo", kind: "textarea", max: 500 },
      { name: "category", label: "Categoria", kind: "text", max: 60, help: "Ex.: Palestra, Curso, Simpósio." },
      { name: "eventStatus", label: "Status", kind: "select", options: opt({ agendado: "Agendado", adiado: "Adiado", cancelado: "Cancelado", encerrado: "Encerrado" }) },
      { name: "startAt", label: "Início", kind: "datetime", required: true },
      { name: "endAt", label: "Término", kind: "datetime", nullable: true },
      { name: "location", label: "Local", kind: "text", max: 200 },
      { name: "registrationUrl", label: "Link externo de inscrição", kind: "url", nullable: true, help: "Somente https://." },
      ...cover,
      {
        name: "schedule",
        label: "Programação",
        kind: "objectList",
        itemFields: [
          { name: "time", label: "Horário", kind: "text", max: 20 },
          { name: "title", label: "Atividade", kind: "text", max: 200, required: true },
          { name: "description", label: "Descrição", kind: "text", max: 500 },
        ],
      },
      {
        name: "speakers",
        label: "Palestrantes",
        kind: "objectList",
        itemFields: [
          { name: "name", label: "Nome", kind: "text", max: 120, required: true },
          { name: "role", label: "Cargo/Instituição", kind: "text", max: 160 },
          { name: "bio", label: "Minibiografia", kind: "text", max: 600 },
        ],
      },
      { name: "descriptionHtml", label: "Descrição", kind: "rich" },
    ],
  },
  equipe: {
    key: "equipe",
    api: "team",
    label: "Equipe",
    singular: "membro",
    titleField: "name",
    defaults: { name: "", position: "", group: "membros", course: "", period: "", bio: "", order: 100 },
    fields: [
      { name: "name", label: "Nome", kind: "text", required: true, max: 120 },
      { name: "position", label: "Cargo", kind: "text", required: true, max: 120 },
      {
        name: "group",
        label: "Categoria",
        kind: "select",
        options: opt({ presidencia: "Presidência", vice_presidencia: "Vice-presidência", diretoria: "Diretoria", coordenacao: "Coordenação", membros: "Membros" }),
      },
      { name: "order", label: "Ordem de exibição", kind: "number", help: "Menor número aparece primeiro." },
      { name: "course", label: "Curso", kind: "text", max: 120 },
      { name: "period", label: "Período acadêmico", kind: "text", max: 40 },
      { name: "bio", label: "Breve descrição", kind: "textarea", max: 600 },
      { name: "link", label: "Link profissional (opcional)", kind: "url", nullable: true },
      { name: "photoMediaId", label: "Foto", kind: "media", mediaKind: "image", nullable: true },
    ],
  },
  processos: {
    key: "processos",
    api: "selection-processes",
    label: "Processos seletivos",
    singular: "processo seletivo",
    titleField: "title",
    publicPath: (s) => `/processo-seletivo/${s}`,
    defaults: { title: "", summary: "", descriptionHtml: "", phase: "em_breve", requirements: [], schedule: [], stages: [], criteria: [], documents: [] },
    fields: [
      { name: "title", label: "Nome do processo", kind: "text", required: true, max: 200 },
      { name: "slug", label: "URL amigável (slug)", kind: "text", max: 80 },
      { name: "summary", label: "Descrição curta", kind: "textarea", max: 500 },
      { name: "phase", label: "Status do processo", kind: "select", options: PHASES },
      { name: "registrationStart", label: "Início das inscrições", kind: "datetime", nullable: true },
      { name: "registrationEnd", label: "Fim das inscrições", kind: "datetime", nullable: true },
      {
        name: "registrationUrl",
        label: "Link do formulário externo de inscrição",
        kind: "url",
        nullable: true,
        help: "Google Forms, Microsoft Forms etc. Somente https://. O botão “Realizar inscrição” só aparece com o status “Inscrições abertas”.",
      },
      { name: "noticeMediaId", label: "Edital (PDF enviado)", kind: "media", mediaKind: "pdf", nullable: true },
      { name: "noticeUrl", label: "Edital (link externo, alternativo)", kind: "url", nullable: true },
      { name: "vacancies", label: "Vagas disponíveis", kind: "number", nullable: true },
      { name: "requirements", label: "Requisitos", kind: "stringList" },
      {
        name: "schedule",
        label: "Cronograma",
        kind: "objectList",
        itemFields: [
          { name: "date", label: "Data", kind: "text", max: 40, required: true },
          { name: "label", label: "Etapa/atividade", kind: "text", max: 200, required: true },
        ],
      },
      {
        name: "stages",
        label: "Etapas",
        kind: "objectList",
        itemFields: [
          { name: "title", label: "Etapa", kind: "text", max: 160, required: true },
          { name: "description", label: "Descrição", kind: "text", max: 600 },
        ],
      },
      { name: "criteria", label: "Critérios de seleção", kind: "stringList" },
      {
        name: "documents",
        label: "Outros documentos (homologações, anexos…)",
        kind: "objectList",
        itemFields: [
          { name: "label", label: "Nome", kind: "text", max: 160, required: true },
          { name: "mediaId", label: "Arquivo PDF", kind: "media", mediaKind: "pdf" },
          { name: "url", label: "ou link https", kind: "url" },
        ],
      },
      { name: "descriptionHtml", label: "Descrição completa", kind: "rich" },
    ],
  },
};
