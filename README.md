# Albus · Calendário financeiro para casal

Projeto web estático, responsivo, com calendário mensal, eventos, despesas e motor de planejamento por **data da compra** e **data do pagamento**.

## Como executar

Abra `index.html` em um servidor HTTP estático (por exemplo, `python3 -m http.server 8080` e acesse `http://localhost:8080`). A Vercel pode servir esta pasta sem processo de build. Scripts separados são `engine.js` (regras financeiras) e `app.js` (interface), com estilos complementares em `app-v2.css`.

## Alterações da PR 3

- **Calendário e painel:** o calendário mensal mantém a identidade visual anterior, com detalhes do dia à direita. Um clique seleciona o dia. Os quadrantes mostram entradas/saídas, até dois eventos ou despesas e `+N itens`.
- **Eventos e despesas separados:** eventos podem conter várias despesas; o custo do evento é apenas a soma dos itens associados, não um lançamento adicional.
- **Movimentação:** arraste eventos ou despesas até outro dia. Mover o evento move todas as suas despesas vinculadas pelo mesmo deslocamento em dias. Mover uma despesa altera somente aquela despesa. O botão de mover oferece alternativa ao toque; alterações em lançamentos já efetivados exigem confirmação.
- **Pagamento:** padrão selecionável (mês da compra ou cartão posterior) que define o **método inicial** para novos lançamentos; cada despesa permite alterar para Pix, débito, dinheiro ou cartão.
- **Cartão:** configura dia de fechamento e vencimento, com ajuste para meses curtos. Compras feitas antes/depois do fechamento entram na fatura correspondente. O painel mensal agrupa pagamentos por mês de vencimento, sem somar a compra e a fatura novamente como duas despesas.
- **Visões:** seletor de calendário pela data da compra ou pelo pagamento, preservando o cálculo de caixa nos indicadores.
- **Planejamento:** o antigo “saldo livre” agora é “Valor a destinar”, com destaque de déficit quando negativo. A configuração de imprevistos inclui percentual das despesas variáveis e parcela fixa. A variação esperada é um indicador de cenário, não uma nova despesa.
- **Formulários:** clique no fundo do modal não fecha formulários; use X ou Cancelar.
- **Virada de dia:** atualiza o dia atual sem recarregar a página, preservando formulários.
- **Navegação:** sem abas redundantes e sem nova página de Metas.

## Exemplo: receita de novembro e fatura de outubro

Para cartão que fecha em 25 e vence em 5:
- Compra em 14 de outubro → fatura com vencimento em **5 de novembro**.
- Compra em 14 de novembro → fatura com vencimento em **5 de dezembro**.
- Compra em 28 de novembro → fatura com vencimento em **5 de janeiro**.

Assim, a receita prevista em novembro é comparada com **os pagamentos que vencem em novembro**, mesmo que as compras tenham sido feitas em outubro. Não se presume que toda compra no cartão seja paga automaticamente no mês seguinte: o fechamento altera essa relação.

## Armazenamento e segurança

**A PR ainda usa o modo local.** Lançamentos permanecem no `localStorage` do navegador, na chave `albus-calendar-local-v1`. Os cadastros já realizados no MVP são lidos por essa versão. Não há migração destrutiva, nem exclusão do histórico no navegador.

**Ainda não há login, sincronização real, banco compartilhado, backup em nuvem ou gestão de cartões múltiplos.** Estes recursos dependem de Supabase próprio e políticas RLS; não cadastre informações sensíveis ou insubstituíveis antes dessa etapa.

O motor oferece apenas **um cartão configurável** nesta fase. Não cobre compras parceladas, rotativo, juros, alteração retroativa de faturas fechadas ou conciliação com extratos bancários. Compras em cartão representam valor integral previsto na fatura correspondente; pagamentos parciais não são modelados.

## Testes

Execute `node --test tests/engine.test.cjs`. O motor é JavaScript sem dependências; os testes cobrem ciclos de fatura, fechamento, meses curtos, orçamento, provisões e movimentações de evento/despesa.

## Cuidados antes de incorporar a PR

Validar visualmente o calendário e os fluxos de cadastro, edição e movimentação em desktop e celular. Testar com dados reais de exemplo, principalmente compras após o fechamento. Conferir que o comportamento das recorrências atende suas expectativas antes de utilizá-las como pagamentos definitivos. **Não incorporar a PR diretamente à produção sem revisão.**

## PR 3, Bloco 1 adicional: ambiente familiar de teste

A interface de desenvolvimento inclui os perfis demonstrativos **Rodrigo** e **Danielle**, identificados no cabeçalho como **Usuário em teste**, dentro do espaço **Família**. É possível alternar o usuário simulado e filtrar a visualização por todos os registros acessíveis, compartilhados ou por responsável.

Nos cadastros de eventos, receitas e despesas são persistidos os campos:
- `workspace_id` (espaço de trabalho familiar de teste);
- `created_by` (criador);
- `responsible_ids` (um ou mais responsáveis);
- `visibility` (`shared` ou `private`).

Para registros particulares, apenas o criador é responsável e o outro perfil não os visualiza nos filtros locais. Os registros do MVP anterior recebem visibilidade compartilhada na leitura, sem serem apagados. O usuário pode adicionar receitas diretamente no topo ou no detalhamento do dia.

O campo título oferece sugestões opcionais de acordo com a categoria: salário, transporte, saúde, moradia, alimentação, educação e lazer. A sugestão só preenche o texto quando clicada, permitindo edição completa.

**Segurança:** alternar o perfil não equivale a entrar em uma conta. Ambos os perfis estão simulados no mesmo navegador. O `localStorage` não garante privacidade entre pessoas que utilizam o mesmo dispositivo. A estrutura foi preparada para evoluir para autenticação real, tabelas relacionais por workspace e regras RLS no Supabase, mas essas integrações **não estão implementadas nesta PR**.

**Fora do Bloco 1:** objetivos financeiros (antigas reservas/investimentos), acompanhamento de metas, aportes, CDI e projeções de rendimento. Ficam para a próxima implementação, conforme combinado.

### Testes adicionais

`node --test tests/access-model.test.cjs` valida membros, responsáveis compartilhados, filtros individuais, migração de itens anteriores e restrições locais de propriedade. O teste de renderização também verificou o filtro do usuário e a ausência da despesa privada da Danielle no painel inicial simulado do Rodrigo.

## Albus v3 — calendário primeiro e caixinhas (04/11/2026)

A PR #3 agora ativa `app-v3.js` e `goals.js` a partir de `index.html`; os arquivos anteriores permanecem para facilitar comparação/reversão durante a revisão.

**Fluxo de criação:** botão único `Criar` no cabeçalho do calendário com Evento, Despesa, Receita, Objetivo (caixinha) e Tarefa. O cadastro usa a data do calendário selecionada, com texto correspondente ao tipo: compra, recebimento, aporte ou tarefa.

**Layout:** indicadores compactos no topo, objetivos abaixo, e três regiões principais: filtros verticais à esquerda, calendário central e detalhamento do dia à direita. Removidos os botões duplicados de criação no topo e no painel lateral. Mantido o arrastar e soltar com alternativa de menu para mover.

**Participantes e visibilidade:** Rodrigo e Danielle, múltiplos participantes, opção Selecionar todos e visibilidade familiar por padrão. Privacidade individual continua sendo simulação local, não autenticação verdadeira.

**Recorrência:** mensal em dia fixo ou no N-ésimo dia útil, com opção de contar sábado (convenção de pagamento de salários). O cálculo usa feriados nacionais fixos e é estimado: não incorpora automaticamente feriados móveis, locais e pontos facultativos. Edição de uma única ocorrência mantém a série e salva a alteração em `overrides`.

**Objetivos:** cadastro de caixinhas com nome, meta, saldo real inicial, aporte mensal pretendido, % de CDI e taxa anual manual opcional. Saldo real inclui aportes avulsos confirmados e confirmações de ocorrências recorrentes. Aporte planejado afeta o orçamento somente quando é cadastrado como lançamento de reserva, não apenas ao informar um número na meta. Projeções de saldo/meta são separadas dos valores realizados; não incluem impostos, taxas ou mudanças futuras de rendimento. O cadastro da meta **não gera automaticamente um aporte no calendário**: para planejar um aporte mensal, use Registrar aporte e marque Repetir mensalmente.

**CDI:** consulta tentativa ao indicador diário SGS 12 do Banco Central, uma vez por dia, armazenando data e taxa em cache. O valor anual é aproximado a partir de 252 dias úteis, sem garantia de retorno. Caso a consulta falhe (inclusive por restrições do navegador), a projeção usa o último cache disponível ou taxa anual manual informada.

**Segurança e dados:** mantém `albus-calendar-local-v1` e os cadastros anteriores. Não há autenticação, sincronização real, backup, gerenciamento de cartões múltiplos nem conciliação bancária. A PR não foi incorporada à `main`.

**Testes:** arquivos `tests/engine.test.cjs`, `tests/access-model.test.cjs`, `tests/goals-flow.test.cjs`. Inspeção de sintaxe e renderização inicial concluída; interações de formulários e movimento entre dias precisam ser testadas manualmente no preview.

## Refinamento do fluxo de criação e filtros (04/11/2026)

- O botão **Hoje** está no cabeçalho do calendário, junto às setas para navegar entre meses. A ação seleciona a data atual e abre o mês correspondente.
- O menu único **Criar** passou para o painel **Detalhamento do dia**, imediatamente após os totais de entradas e saídas. Os cinco tipos permanecem: Evento, Despesa, Receita, Objetivo e Tarefa.
- Os filtros **Exibir lançamentos**, **Como costuma pagar?** e **Mostrar despesas por** receberam indicadores `i` com explicações contextuais, acessíveis por clique e teclado.
- Campos de valores monetários em receitas, despesas, caixinhas, aportes e provisão de imprevistos exibem **R$ 0,01**, **R$ 12,34**, etc. enquanto o usuário digita. A máscara formata apenas a exibição e mantém o valor em centavos para cálculos/persistência.
- Máscara reutilizável: `currency-mask.js`. Testes: `node --test tests/creation-ux.test.cjs`.
- Os dados existentes no `localStorage` e a branch principal foram mantidos. Não há autenticação nem persistência em servidor nesta etapa.

## Correção do arrastar e segurança dos dados (04/11/2026)

- **Arrastar entre dias:** a interface `app-v3.js` usa `Pointer Events`, com captura do ponteiro, realce da célula de destino e suporte a mouse, caneta e telas sensíveis ao toque. No celular, segure a alça `⠿` do lançamento/evento; no calendário, arraste o chip diretamente. O botão `↔` permanece como alternativa de acessibilidade.
- **Eventos:** mover um evento move todas as despesas vinculadas, preservando valores e demais propriedades.
- **Recorrências:** arrastar uma ocorrência mensal altera a data somente daquele mês; a série principal não é modificada. Para compras no cartão exibidas pela visão de caixa, mover o lançamento ajusta a data prevista de pagamento, sem alterar a compra original. Não há conciliação bancária automática.
- **Persistência sem substituição:** o armazenamento permanece em `localStorage` com chave **`albus-calendar-local-v1`**. Não existe comando de limpar os dados durante a atualização. O motor agora preserva campos desconhecidos do registro anterior. Antes de cada gravação, uma cópia do estado anterior é armazenada em `albus-calendar-local-v1-snapshot`.
- **Exportar:** `↓ Backup` baixa um arquivo JSON com todos os cadastros salvos naquele endereço e navegador.
- **Importar:** `↑ Importar` lê um backup JSON e apenas **adiciona itens com IDs ausentes**; não substitui os já cadastrados. Configurações locais atuais são preservadas. Importações exigem confirmação.
- **Cuidado com endereços:** a URL permanente da branch não compartilha `localStorage` com URLs únicas de deploy da Vercel. Caso dados antigos estejam em outro hostname, abra aquele hostname no mesmo navegador e exporte os dados de lá antes de importá-los no link permanente.
- **Limites:** os snapshots também ficam no mesmo navegador e não substituem backup externo. Um usuário que limpe os dados do site, troque de navegador/dispositivo ou perca o equipamento poderá perder os lançamentos que não exportou.
- **Testes:** `node --test tests/drag-backup.test.cjs` cobre gesto de arrastar, movimentação de evento com despesas, recorrência individual, falha de escrita, backup e importação.

**Não houve merge na `main` nem alteração no endereço oficial.**

## Refinamentos de interface, eventos e cartão (04/11/2026)

- **Ajuda contextual:** os ícones `i` dos filtros agora abrem um popover em `document.body` com posição limitada à janela visível. O conteúdo não é cortado pela barra lateral. Fecha por clique fora, ao pressionar Esc ou ao selecionar o próprio ícone.
- **Editor de eventos:** tanto ao criar quanto ao editar um evento, a seção **Despesas vinculadas** aparece antes das observações. É possível adicionar diversas despesas com nome, valor, data de compra, categoria, pagamento e situação. Uma janela secundária de despesa é aberta por cima do formulário do evento; o botão **Voltar ao evento** ou o X retorna ao formulário original, preservando título, data, participantes e observações.
- **Resumo e atomicidade:** despesas novas ficam em rascunho e aparecem em lista com valor e total, com opção de remover antes de salvar. O botão **Salvar evento** grava evento e despesas vinculadas juntos, preservando os dados existentes caso a escrita falhe. Despesas criadas posteriormente no cadastro independente ainda podem ser vinculadas ao evento por `Associar a evento`. Despesas existentes vinculadas aparecem no resumo sem serem duplicadas.
- **Origem dos pagamentos:** os indicadores continuam baseados no mês em que o dinheiro sai. Novo quadro de origem no resumo mensal e detalhamento diário: **Cartão · compras anteriores**, **Cartão · compras do mês** e **Pix, débito e dinheiro**. O valor é somente decomposto, não cobrado em duplicidade. Lançamentos de cartão detalham data de compra e vencimento.
- **Compatibilidade:** `albus-calendar-local-v1` foi mantido, assim como a importação/exportação de backups e a prévia fixa da branch. Não houve atualização do site oficial ou merge na `main`.
- **Verificação:** `node --test tests/event-nested-payments.test.cjs` (cinco cenários) valida prévia dos dois modais, gravação conjunta, falha de armazenamento sem perda, cartão comprado em novembro e pago em dezembro, e popover limitado à tela. A navegação manual em navegadores variados ainda deve ser conferida no preview.

## Resumo financeiro fixo no scroll (04/11/2026)

O quadro de **Receitas**, **Pagamentos previstos**, **Reservas e imprevistos** e **Valor a destinar** foi agrupado com a seção **Origem dos pagamentos** em uma faixa `position: sticky` no topo da rolagem. O cabeçalho Albus, o título e a mensagem explicativa continuam rolando normalmente. Objetivos, filtros, calendário e painel do dia também permanecem no fluxo normal, abaixo da faixa financeira.

Ao fixar, o resumo reduz o espaçamento e oculta a descrição auxiliar dos cards, preservando os números. O comportamento é adaptado para larguras menores. Valores de receita são verdes; pagamentos, vermelhos; reservas/imprevistos, azuis; valor a destinar, vermelho, com zero equilibrado em verde. O saldo negativo exibe o sinal de menos em vez de valor absoluto, com descrição de déficit.

Alteração somente de layout e apresentação: **não modifica o formato, as chaves de armazenamento nem os cálculos financeiros**. Arquivo de validação: `tests/sticky-summary.test.cjs`. Ainda é recomendada uma revisão visual em telas móveis pequenas, nas quais a faixa ocupa mais altura.

## Reutilização e desvinculação de despesas (04/11/2026)

A ordem do menu **Criar** passou a ser **Despesa → Receita → Evento → Objetivo → Tarefa**. O tipo de lançamento antes chamado “Aporte / reserva” agora aparece como **Reserva ou investimento**, sem mudança da chave interna `reserve`.

**Despesas vinculadas a eventos** podem ser reutilizadas sem apagar ou mover a original:

- Arrastar uma despesa vinculada para um **dia** cria uma **nova cópia independente** naquela data. O lançamento original permanece no evento.
- Arrastar uma despesa para o **cartão de outro evento** no detalhamento do dia cria uma **nova cópia vinculada ao evento de destino**, preservando a original e usando a data do evento de destino.
- O botão **⧉ Reutilizar** oferece a mesma operação sem arrastar: selecione “Despesa independente” ou o evento de destino. É possível repetir a cópia quantas vezes desejar.
- O botão **↗ Desvincular** remove o vínculo de uma despesa existente e a mantém como despesa independente, sem duplicar valores; também está no editor do evento.
- Ao copiar, sempre é gerado um identificador novo. A cópia é **um novo gasto planejado**, com valor/categoria/método herdados e pagamento do cartão recalculado pela nova data. Ela não herda status pago nem vencimento manual da original. Cópias não se tornam recorrentes automaticamente.
- Ao **mover um evento inteiro**, permanece a regra atual de reagendar suas despesas vinculadas; copiar uma despesa isolada não move o evento nem elimina a despesa de origem.
- A ação só pode usar eventos visíveis para o perfil simulado. O armazenamento original `albus-calendar-local-v1` e seus backups permanecem inalterados; gravação da cópia/desvinculação acontece em operação única antes de atualizar a memória da interface.

**Atenção:** a cópia é contabilizada como uma despesa adicional. Não se trata apenas de um vínculo visual que reutiliza o mesmo pagamento. Em caso de gasto único compartilhado por dois eventos, o usuário deve evitar copiar para não duplicar financeiramente.

Testes: `tests/expense-reuse.test.cjs`, mais verificação isolada do arrastar para um dia. A PR segue aberta, sem merge.

## Reserva de emergência como primeiro objetivo e aportes automáticos (05/11/2026)

A seção financeira antes chamada "Reservas e imprevistos" agora se chama **Reservas, objetivos e imprevistos**, somando apenas aportes `reserve` efetivamente previstos no mês e a provisão de imprevistos. O valor configurado como objetivo `monthly_cents` **não é somado separadamente**: ele origina, quando solicitado, exatamente uma série mensal de lançamentos `reserve` associados à meta.

A primeira caixinha sugerida, destacada em verde, é **Reserva de emergência**; ela é priorizada também quando já existe. O cadastro pergunta:
- Receita familiar mensal de referência, sugerida com base nas receitas cadastradas.
- Custo mensal essencial de referência, sugerido pela média de até três meses completos anteriores (ou mês corrente parcial se não houver histórico); pode ser corrigido pelo usuário.
- Cobertura de 6, 12, 18 ou 24 meses, calculando a meta automaticamente pela multiplicação.
- Saldo inicial efetivamente guardado, aporte mensal pretendido, rentabilidade de referência e dia do calendário em que deseja contribuir.

O aplicativo sugere **o dia seguinte ao principal recebimento previsto**, quando houver receitas cadastradas. A data é editável e se repete mensalmente, ajustando-se para o último dia nos meses curtos.

A programação gera um lançamento recorrente **planejado** `reserve` associado ao objetivo: conta no compromisso orçamentário e no cabeçalho, mas **não aumenta o saldo real** enquanto não for confirmado. Confirmações de ocorrências seguem o mecanismo de `overrides`. O calendário mostra um marcador verde para **conquista prevista** no mês e dia de aporte projetados, distinto da mensagem de **meta atingida** quando o saldo real chegar a 100%. Depois de alcançar a meta, o aplicativo recomenda novos objetivos.

A rentabilidade pelo CDI permanece uma simulação; não é creditada automaticamente. O usuário é orientado a reconciliar o saldo real com os rendimentos do banco ou fundo de investimento, sem supor que a taxa permaneça constante.

**Compatibilidade e segurança:** chaves `albus-calendar-local-v1` e `albus-calendar-local-v1-snapshot` mantidas. Ao salvar a meta, `goals` e a série recorrente são gravadas atomicamente pelo mecanismo de backup já existente, antes de atualizar a memória da interface. Editar aporte, dia ou participante encerra a série automática antiga após o mês corrente e inicia a nova no próximo mês, preservando ocorrências e confirmações anteriores. Uma série mensal pré-existente, cadastrada pelo usuário antes desta versão, não será duplicada automaticamente. Sem sincronização entre dispositivos ou login real.

Arquivos: `emergency-planning.js`, `app-v3.js`, `engine.js`, `app-v2.css` e testes `tests/emergency-reserve.test.cjs` (11 casos). Testes do motor e renderização inicial passaram; ainda é necessária revisão manual do fluxo completo de cadastro, confirmação de aportes e layout em celulares.
