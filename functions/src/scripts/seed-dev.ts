/**
 * LOCAL DEVELOPMENT ONLY. Seeds the Firebase emulators with a SUPER_ADMIN and a few
 * items clearly marked "[DEMO]" so the UI can be exercised. Refuses to run against
 * a real project (requires emulator hosts to be set).
 *
 *   npm run build && npm run seed:dev   (with emulators running)
 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, COLLECTIONS, db } from "../lib/firebase";

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    console.error("Recusado: este script só roda contra os emuladores (defina FIRESTORE_EMULATOR_HOST e FIREBASE_AUTH_EMULATOR_HOST).");
    process.exit(1);
  }
  const email = "dev-admin@latox.test";
  const password = randomBytes(12).toString("base64url");
  let uid: string;
  try {
    uid = (await adminAuth.getUserByEmail(email)).uid;
    await adminAuth.updateUser(uid, { password });
  } catch {
    uid = (await adminAuth.createUser({ email, password, displayName: "Dev Admin" })).uid;
  }
  const now = Timestamp.now();
  await db.collection(COLLECTIONS.adminUsers).doc(uid).set({ email, name: "Dev Admin", role: "SUPER_ADMIN", status: "active", createdAt: now, mfaEnrolled: false });

  const base = { status: "published", publishAt: now, publishedAt: now, createdAt: now, updatedAt: now, createdBy: uid, updatedBy: uid };
  const day = 86_400_000;
  await db.collection(COLLECTIONS.news).doc("demoNews001").set({
    ...base,
    title: "[DEMO] Notícia de exemplo",
    slug: "demo-noticia-de-exemplo",
    summary: "Conteúdo fictício para desenvolvimento local. Não é informação oficial da LATox.",
    contentHtml: "<p>Texto de demonstração.</p><h2>Subtítulo</h2><p>Mais texto de exemplo.</p>",
    category: "Demonstração",
    author: "Equipe de desenvolvimento",
  });
  await db.collection(COLLECTIONS.projects).doc("demoProject01").set({
    ...base,
    title: "[DEMO] Projeto de exemplo",
    slug: "demo-projeto-de-exemplo",
    summary: "Projeto fictício para testar o layout.",
    descriptionHtml: "<p>Descrição de demonstração.</p>",
    category: "Extensão",
    projectStatus: "em_andamento",
    responsible: ["Pessoa Exemplo"],
  });
  await db.collection(COLLECTIONS.events).doc("demoEvent0001").set({
    ...base,
    title: "[DEMO] Palestra de exemplo",
    slug: "demo-palestra-de-exemplo",
    summary: "Evento fictício.",
    descriptionHtml: "<p>Descrição do evento de demonstração.</p>",
    category: "Palestra",
    startAt: Timestamp.fromMillis(Date.now() + 7 * day),
    location: "Local a definir",
    eventStatus: "agendado",
    schedule: [{ time: "19:00", title: "Abertura" }],
    speakers: [{ name: "Palestrante Exemplo", role: "Convidado(a)" }],
  });
  await db.collection(COLLECTIONS.selectionProcesses).doc("demoProcess01").set({
    ...base,
    title: "[DEMO] Processo seletivo de exemplo",
    slug: "demo-processo-seletivo",
    summary: "Processo fictício para testar o fluxo de inscrição externa.",
    descriptionHtml: "<p>Edital de demonstração.</p>",
    phase: "inscricoes_abertas",
    registrationUrl: "https://forms.gle/exemplo-demo",
    requirements: ["Requisito de exemplo"],
    schedule: [{ date: "01/12", label: "Inscrições" }],
    stages: [{ title: "Prova escrita" }],
    criteria: ["Critério de exemplo"],
    vacancies: 10,
  });

  const out = join(process.cwd(), ".dev-admin.local.txt");
  writeFileSync(out, `Emulator-only admin\nemail: ${email}\npassword: ${password}\n`, { mode: 0o600 });
  console.log(`Seed concluído. Credenciais do admin de desenvolvimento gravadas em ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
