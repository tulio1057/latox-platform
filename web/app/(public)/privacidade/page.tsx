import type { Metadata } from "next";
import { PageHero, RichText } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const revalidate = 60;
export const metadata: Metadata = { title: "Política de Privacidade", description: "Como a LATox trata dados pessoais (LGPD)." };

/**
 * If the administration has not yet published a reviewed policy, a baseline text that
 * reflects how THIS site actually works is shown. It must be reviewed by the league's
 * leadership (and ideally legal counsel) and replaced via Admin › Configurações.
 */
function BaselinePolicy({ email, name }: { email: string; name: string }) {
  return (
    <div className="prose">
      <div className="notice" role="note">
        Versão-base gerada a partir do funcionamento técnico do site. Deve ser revisada e aprovada pela diretoria da {name} antes
        da publicação oficial.
      </div>
      <h2>1. Quem somos</h2>
      <p>
        Este site é mantido pela {name}. O controlador dos dados pessoais tratados neste site é a própria liga, representada por sua diretoria.
      </p>
      <h2>2. Quais dados este site coleta</h2>
      <p>
        <strong>Visitantes:</strong> o site não possui cadastro público, formulários de contato próprios, cookies de publicidade nem
        ferramentas de rastreamento de terceiros. Os servidores de hospedagem (Vercel e Google Firebase) registram dados técnicos de acesso — como
        endereço IP, data/hora e navegador — para segurança e prevenção de abusos. Endereços IP usados em limites de acesso são armazenados
        apenas em forma cifrada (hash) e por curto período.
      </p>
      <p>
        <strong>Administradores:</strong> nome, e-mail institucional, papel de acesso e registros de auditoria das ações realizadas no
        painel, com a finalidade de segurança e responsabilização. É utilizado um cookie estritamente necessário de sessão, apenas no painel.
      </p>
      <h2>3. Processos seletivos e formulários externos</h2>
      <p>
        As inscrições em processos seletivos <strong>não</strong> são feitas neste site. Ao clicar em “Realizar inscrição”, você é
        direcionado(a) ao formulário oficial no <strong>Google Forms</strong>, que coleta: <strong>nome completo, e-mail, curso e período</strong>.
        As respostas ficam armazenadas na conta Google da {name} (Google Forms e Planilhas Google), com acesso restrito à diretoria
        responsável pela seleção, e são usadas exclusivamente para conduzir e comunicar o processo seletivo. O Google atua como operador
        desses dados e possui política de privacidade própria. Após a inscrição, você recebe por e-mail um número de inscrição.
      </p>
      <p>
        Nos resultados publicados neste site, candidatos são identificados apenas pelo número de inscrição/protocolo. Não publicamos CPF,
        e-mail, telefone ou documentos pessoais.
      </p>
      <h2>4. Bases legais (LGPD, art. 7º)</h2>
      <p>
        Execução de procedimentos preliminares relacionados à participação no processo seletivo, a pedido do titular; legítimo interesse
        para segurança do site e do painel; e cumprimento de obrigações de transparência do processo seletivo.
      </p>
      <h2>5. Retenção</h2>
      <p>
        Registros técnicos de segurança: até 6 meses. Registros de auditoria do painel: até 5 anos. Dados de inscrição coletados no
        formulário: até 6 meses após a divulgação do resultado final (prazo que cobre eventuais recursos), sendo então excluídos do
        formulário e da planilha, salvo obrigação legal ou institucional de guarda.
      </p>
      <h2>6. Direitos do titular</h2>
      <p>
        Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação e informações sobre
        compartilhamento, nos termos do art. 18 da LGPD, pelo canal indicado abaixo.
      </p>
      <h2>7. Contato sobre privacidade</h2>
      <p>{email ? <a href={`mailto:${email}`}>{email}</a> : "Canal de privacidade a ser definido pela diretoria."}</p>
    </div>
  );
}

export default async function PrivacyPage() {
  const s = await api.settings();
  const email = s.privacyEmail || s.contactEmail;
  return (
    <>
      <PageHero eyebrow="LGPD" title="Política de Privacidade" lead={s.privacyUpdatedAt ? `Última atualização: ${formatDate(`${s.privacyUpdatedAt}T12:00:00Z`)}` : undefined} />
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container article">
          {s.privacyPolicyHtml ? <RichText html={s.privacyPolicyHtml} /> : <BaselinePolicy email={email} name={s.shortName} />}
        </div>
      </section>
    </>
  );
}
