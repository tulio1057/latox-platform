# Formulário de inscrição (Google Forms)

As inscrições **não** passam pelo site: o botão "REALIZAR INSCRIÇÃO" leva ao Google Forms oficial. O script [`inscricao-latox.gs`](inscricao-latox.gs) cria esse formulário com:

- campos **Nome completo**, **E-mail**, **Curso**, **Período** e aceite LGPD (todos obrigatórios);
- uma planilha de respostas com a aba **Inscrições**;
- um **número de inscrição** automático (ex.: `PS2027-0001`) enviado por e-mail ao candidato — é esse número que vai nos resultados publicados no site, nunca nome/e-mail.

## Passo a passo (uma vez por processo seletivo)

1. Entre na **conta Google institucional da liga** (não use conta pessoal: os dados ficam nela).
2. Acesse https://script.google.com → **Novo projeto**. Renomeie para "Inscrição PS 2027".
3. Apague o conteúdo de `Code.gs` e cole todo o arquivo `inscricao-latox.gs`.
4. No topo, ajuste `CONFIG`: `PREFIXO`, `TITULO`, `LINK_EDITAL`, `LINK_PRIVACIDADE`, `EMAIL_CONTATO`.
5. Selecione a função **`criarFormulario`** e clique em **Executar**. Autorize as permissões pedidas (Forms, Planilhas, envio de e-mail e gatilhos — são usadas só por este script).
6. Em **Execuções/Registro**, copie o **LINK PÚBLICO** (`https://docs.google.com/forms/d/e/.../viewform`).
7. No painel da LATox: **Processos seletivos → (processo) → "Link do formulário externo de inscrição"**, cole o link, salve e mude o status para **Inscrições abertas**. O botão aparece no site em até 1 minuto.
8. Faça uma inscrição de teste e confira: número na aba "Inscrições" e e-mail recebido. Depois apague a linha de teste.

## Durante e depois do processo

- Encerrar: rode `encerrarInscricoes` (ou desative "Aceitando respostas" no Forms) e mude o status no painel para **Inscrições encerradas** — o botão some do site.
- Resultados: no painel, em Resultados, cole uma linha por candidato no formato `PS2027-0001;1;Aprovado`. Nunca inclua nome, e-mail ou CPF.
- LGPD: compartilhe a planilha só com quem conduz a seleção. Ao fim do prazo de retenção, rode `excluirDadosDoProcesso` (exige mudar `CONFIRMAR` para `true`) e esvazie a lixeira do Drive.

## Limites

- Envio de e-mail: ~100/dia em contas Gmail comuns, ~1500/dia em Google Workspace. Acima disso o e-mail falha, mas a inscrição e o número continuam registrados na planilha.
- O formulário não exige login Google (para não excluir quem não tem conta); por isso duplicidades são apenas sinalizadas na coluna "Observação".
- Não coloque dados de candidatos na URL do formulário (sem links pré-preenchidos com dados pessoais).
