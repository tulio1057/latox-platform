/**
 * LATox — Formulário de inscrição do processo seletivo (Google Forms + Apps Script)
 *
 * O que este script faz:
 *  1. criarFormulario(): cria o Google Forms com Nome, E-mail, Curso, Período e o aceite
 *     LGPD, uma planilha de respostas e o gatilho de envio.
 *  2. aoEnviarResposta(): a cada inscrição gera um número sequencial (ex.: PS2027-0001),
 *     registra na aba "Inscrições" e envia o número por e-mail ao candidato.
 *     Os resultados no site da LATox usam APENAS esse número — nunca nome ou e-mail.
 *  3. encerrarInscricoes(): fecha o formulário para novas respostas.
 *  4. excluirDadosDoProcesso(): apaga as respostas ao fim do prazo de retenção (LGPD).
 *
 * Como usar: veja integrations/google-forms/README.md.
 */

// ===================== CONFIGURE AQUI =====================
const CONFIG = {
  PREFIXO: 'PS2027', // prefixo do número de inscrição
  TITULO: 'Inscrição — Processo Seletivo LATox 2027',
  NOME_LIGA: 'Liga Acadêmica de Toxicologia (LATox)',
  LINK_EDITAL: '', // ex.: https://seu-site.vercel.app/processo-seletivo/processo-seletivo-2027
  LINK_PRIVACIDADE: '', // ex.: https://seu-site.vercel.app/privacidade
  EMAIL_CONTATO: '', // e-mail da liga para dúvidas e pedidos sobre dados pessoais
  PRAZO_RETENCAO: '6 meses após a divulgação do resultado final',
  PERIODOS: ['1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º', '10º', '11º', '12º', 'Outro'],
  ENVIAR_EMAIL_CONFIRMACAO: true,
};
// ==========================================================

const ABA_INSCRICOES = 'Inscrições';
const CAMPOS = {
  NOME: 'Nome completo',
  EMAIL: 'E-mail',
  CURSO: 'Curso',
  PERIODO: 'Período',
  ACEITE: 'Declaração e consentimento',
};

function criarFormulario() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('FORM_ID')) {
    throw new Error('O formulário já foi criado (FORM_ID existe). Para um novo processo, crie um novo projeto de script.');
  }

  const form = FormApp.create(CONFIG.TITULO);
  form
    .setDescription(descricaoLgpd_())
    .setCollectEmail(false)
    .setAllowResponseEdits(false)
    .setShowLinkToRespondAgain(false)
    .setProgressBar(false)
    .setConfirmationMessage(
      'Inscrição recebida! Você receberá no e-mail informado o seu número de inscrição. ' +
        'Guarde-o: os resultados serão divulgados no site da LATox somente por esse número.'
    );

  form
    .addTextItem()
    .setTitle(CAMPOS.NOME)
    .setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(120).build());

  form
    .addTextItem()
    .setTitle(CAMPOS.EMAIL)
    .setHelpText('O número de inscrição será enviado para este e-mail.')
    .setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().setHelpText('Informe um e-mail válido.').build());

  form
    .addTextItem()
    .setTitle(CAMPOS.CURSO)
    .setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(120).build());

  form.addListItem().setTitle(CAMPOS.PERIODO).setChoiceValues(CONFIG.PERIODOS).setRequired(true);

  const aceite = form.addCheckboxItem().setTitle(CAMPOS.ACEITE).setRequired(true);
  aceite.setChoices([
    aceite.createChoice(
      'Li o edital e estou ciente de que meus dados (nome, e-mail, curso e período) serão usados ' +
        'exclusivamente para este processo seletivo, conforme a Política de Privacidade da LATox.'
    ),
  ]);

  const planilha = SpreadsheetApp.create(CONFIG.TITULO + ' (respostas)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, planilha.getId());
  const aba = planilha.insertSheet(ABA_INSCRICOES, 0);
  aba.appendRow(['Nº de inscrição', 'Data/hora', 'Nome', 'E-mail', 'Curso', 'Período', 'Observação', 'ID da resposta']);
  aba.setFrozenRows(1);
  aba.getRange('A1:H1').setFontWeight('bold');

  ScriptApp.newTrigger('aoEnviarResposta').forForm(form).onFormSubmit().create();

  props.setProperties({ FORM_ID: form.getId(), PLANILHA_ID: planilha.getId(), CONTADOR: '0' });

  Logger.log('Formulário criado.');
  Logger.log('LINK PÚBLICO (cole no painel da LATox, campo "Link do formulário externo de inscrição"): ' + form.getPublishedUrl());
  Logger.log('Editar formulário: ' + form.getEditUrl());
  Logger.log('Planilha de respostas (acesso restrito à diretoria): ' + planilha.getUrl());
}

function aoEnviarResposta(e) {
  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let numero;
  try {
    numero = Number(props.getProperty('CONTADOR') || '0') + 1;
    props.setProperty('CONTADOR', String(numero));
  } finally {
    lock.releaseLock();
  }
  const protocolo = CONFIG.PREFIXO + '-' + String(numero).padStart(4, '0');

  const respostas = {};
  e.response.getItemResponses().forEach(function (r) {
    respostas[r.getItem().getTitle()] = r.getResponse();
  });
  const nome = String(respostas[CAMPOS.NOME] || '').trim();
  const email = String(respostas[CAMPOS.EMAIL] || '').trim().toLowerCase();
  const curso = String(respostas[CAMPOS.CURSO] || '').trim();
  const periodo = String(respostas[CAMPOS.PERIODO] || '').trim();

  const aba = SpreadsheetApp.openById(props.getProperty('PLANILHA_ID')).getSheetByName(ABA_INSCRICOES);
  const emailsExistentes = aba.getLastRow() > 1 ? aba.getRange(2, 4, aba.getLastRow() - 1, 1).getValues().map(function (l) { return l[0]; }) : [];
  const observacao = emailsExistentes.indexOf(email) >= 0 ? 'E-mail já inscrito anteriormente — verificar duplicidade' : '';

  // Prefixo "'" impede que o conteúdo seja interpretado como fórmula na planilha.
  aba.appendRow([protocolo, e.response.getTimestamp(), "'" + nome, "'" + email, "'" + curso, "'" + periodo, observacao, e.response.getId()]);

  if (CONFIG.ENVIAR_EMAIL_CONFIRMACAO && email) {
    MailApp.sendEmail({
      to: email,
      subject: 'Inscrição recebida — ' + CONFIG.TITULO,
      htmlBody:
        '<p>Olá, ' + escapeHtml_(nome) + '!</p>' +
        '<p>Recebemos sua inscrição no processo seletivo da ' + escapeHtml_(CONFIG.NOME_LIGA) + '.</p>' +
        '<p style="font-size:18px">Seu número de inscrição: <strong>' + protocolo + '</strong></p>' +
        '<p>Guarde este número: os resultados serão publicados no site da LATox <strong>apenas</strong> pelo número de inscrição.</p>' +
        (CONFIG.LINK_EDITAL ? '<p>Edital e cronograma: <a href="' + CONFIG.LINK_EDITAL + '">' + CONFIG.LINK_EDITAL + '</a></p>' : '') +
        '<p style="color:#666;font-size:12px">Você recebeu este e-mail porque se inscreveu no formulário oficial. ' +
        (CONFIG.EMAIL_CONTATO ? 'Dúvidas ou pedidos sobre seus dados: ' + escapeHtml_(CONFIG.EMAIL_CONTATO) + '.' : '') +
        '</p>',
      name: 'LATox',
    });
  }
}

/** Fecha o formulário para novas inscrições. */
function encerrarInscricoes() {
  const form = FormApp.openById(PropertiesService.getScriptProperties().getProperty('FORM_ID'));
  form.setAcceptingResponses(false).setCustomClosedFormMessage('As inscrições para este processo seletivo estão encerradas.');
  Logger.log('Inscrições encerradas.');
}

/**
 * LGPD — retenção: ao fim do prazo, apaga todas as respostas do formulário e as linhas
 * das planilhas. Irreversível. Para executar, mude CONFIRMAR para true e rode a função.
 */
function excluirDadosDoProcesso() {
  const CONFIRMAR = false;
  if (!CONFIRMAR) throw new Error('Por segurança, altere CONFIRMAR para true dentro desta função antes de executar.');
  const props = PropertiesService.getScriptProperties();
  FormApp.openById(props.getProperty('FORM_ID')).deleteAllResponses();
  const planilha = SpreadsheetApp.openById(props.getProperty('PLANILHA_ID'));
  planilha.getSheets().forEach(function (aba) {
    if (aba.getLastRow() > 1) aba.deleteRows(2, aba.getLastRow() - 1);
  });
  Logger.log('Dados pessoais do processo excluídos do formulário e da planilha. Verifique também a lixeira do Google Drive e e-mails exportados.');
}

function descricaoLgpd_() {
  return [
    'Formulário oficial de inscrição da ' + CONFIG.NOME_LIGA + '.',
    CONFIG.LINK_EDITAL ? 'Leia o edital antes de se inscrever: ' + CONFIG.LINK_EDITAL : '',
    '',
    'Tratamento de dados pessoais (LGPD):',
    '• Dados coletados: nome completo, e-mail, curso e período.',
    '• Finalidade: realizar e comunicar o processo seletivo. Os resultados são divulgados apenas pelo número de inscrição.',
    '• Acesso restrito à diretoria responsável pela seleção. Os dados são armazenados no Google (Forms/Planilhas) e não são compartilhados com terceiros.',
    '• Retenção: ' + CONFIG.PRAZO_RETENCAO + ', depois são excluídos.',
    CONFIG.EMAIL_CONTATO ? '• Seus direitos (acesso, correção, exclusão): ' + CONFIG.EMAIL_CONTATO : '',
    CONFIG.LINK_PRIVACIDADE ? '• Política de Privacidade: ' + CONFIG.LINK_PRIVACIDADE : '',
  ]
    .filter(function (l) { return l !== ''; })
    .join('\n');
}

function escapeHtml_(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
