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

A interface de desenvolvimento inclui os perfis demonstrativos **Rodrigo** e **Danelle**, identificados no cabeçalho como **Usuário em teste**, dentro do espaço **Família**. É possível alternar o usuário simulado e filtrar a visualização por todos os registros acessíveis, compartilhados ou por responsável.

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

`node --test tests/access-model.test.cjs` valida membros, responsáveis compartilhados, filtros individuais, migração de itens anteriores e restrições locais de propriedade. O teste de renderização também verificou o filtro do usuário e a ausência da despesa privada da Danelle no painel inicial simulado do Rodrigo.
