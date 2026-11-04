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
