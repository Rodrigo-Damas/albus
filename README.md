# Albus · Calendário financeiro para casal

Protótipo interativo de calendário financeiro mensal para planejamento compartilhado.

## Versão nesta PR

- Calendário mensal responsivo e compacto.
- Receitas em verde, despesas em vermelho.
- Clique nos dias para consultar lançamentos no painel de detalhes.
- Cadastro, edição e exclusão de receitas, despesas, reservas e tarefas.
- Resumo financeiro mensal e recorrências mensais.
- Dados fictícios iniciais e armazenamento local no navegador (localStorage).

**Importante:** esta primeira publicação é uma demonstração *local por navegador*. Não há autenticação, sincronização entre dispositivos ou compartilhamento real de dados entre duas contas. A conexão com Supabase será implementada e validada em uma etapa posterior, em projeto de banco dedicado. Não cadastre dados sensíveis nesta versão.

## Como executar

Abra `index.html` em um navegador moderno. Todo o código da demonstração (HTML, CSS e JavaScript) está incorporado no arquivo, sem etapa de compilação.

## Publicar

A aplicação é estática e pode ser importada na Vercel a partir deste repositório, sem framework nem comando de build. Configure o diretório raiz como diretório de saída.

## Regra de cálculo

Saldo livre projetado = receitas previstas − despesas previstas − reservas planejadas.

Reservas reduzem a disponibilidade, mas não contam como despesas. Alterar o status de uma despesa para paga não deve descontá-la novamente do saldo projetado.

## Próximas etapas

1. Refinar interface e experiência de uso após a revisão do protótipo.
2. Integrar autenticação e banco Supabase dedicado, com RLS e convites entre dois membros.
3. Configurar publicação e testar a aplicação em URL pública.

Projeto independente: não altera o Planejador de Visitas nem seus bancos de dados.
