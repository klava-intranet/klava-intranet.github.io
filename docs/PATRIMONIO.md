# Patrimônio — inventário de equipamentos, móveis e ativos

Módulo da intranet (menu **Patrimônio**) para o primeiro inventário da Klava (marco zero, sem razão do imobilizado por item) e para o controle contínuo depois dele.

## Quem acessa
| Papel | Como ganha | O que faz |
| --- | --- | --- |
| Admin | admin da intranet (Tadeu, Luiz) | tudo: cadastros, equipe, saldos contábeis, excluir bem |
| Inventariante | Patrimônio → Cadastros → Equipe | cadastra/edita bens, plaquetagem, campanhas e leituras |
| Consulta | Patrimônio → Cadastros → Equipe | só vê e exporta |

Quem não está na equipe nem é admin não vê o menu. O banco garante isso (RLS).

## Regras que o sistema aplica
- **Placa:** 6 dígitos (000599). Digitar "599" vira "000599". Placa é única e nunca é reaproveitada.
- **Classe:** Imobilizado (deprecia) ou Bem de controle (só placa e responsável). Ao salvar um Imobilizado de até R$ 1.200, o sistema sugere trocar para Bem de controle (Lucro Real).
- **Depreciação:** linear mensal pela taxa do bem (herdada da categoria, editável), só para Imobilizado, a partir da data de aquisição.
- **Histórico:** cadastro, transferência (local ou responsável), baixa e reativação são gravados pelo banco e não podem ser editados.
- **Mostruário de calçados não entra** (é estoque em poder de terceiros). Equipamento da Klava com representante entra, no local "Terceiros · Com representantes".

## Passo a passo do primeiro inventário
1. **Cadastros** (admin): crie as salas de cada escritório (ex.: RJ · Comercial, RJ · Diretoria, RS · Expedição), confira os responsáveis (colaboradores da intranet já vêm cadastrados; inclua representantes) e coloque quem vai plaquetar na **Equipe** como Inventariante. Se quiser, preencha a conta contábil de cada categoria.
2. **Plaquetagem** (celular, sala por sala): Painel → *Iniciar plaquetagem* → escolha a sala e o responsável → cole a placa → leia com a câmera → complete descrição, categoria, conservação e uma foto → *Salvar e ler próxima*. A próxima ficha já vem com a sala, o responsável e a categoria da anterior. Placa já cadastrada abre a ficha existente.
3. **Valores:** com as notas fiscais de compra, preencha data, valor, fornecedor e nº da NF. Bem sem nota: marque *Sem nota fiscal* e informe valor estimado.
4. **Conferência:** Inventário → *Nova campanha* por unidade → *Ler com a câmera*, passando por todas as placas. Cada leitura vira **Encontrado**, **Local divergente** (cadastrado em outra unidade: abra a ficha e corrija) ou **Sem cadastro** (botão *Cadastrar*). Ao *Encerrar*, o que não foi lido vira **Não encontrado**.
5. **Conciliação:** informe o saldo líquido de cada conta do imobilizado (balancete). A diferença mostra o que falta explicar; os não encontrados aparecem como candidatos a baixa. *Exportar planilha* gera o CSV para a contabilidade.
6. **Rotina:** compra nova = cadastrar com placa; mudança de sala/pessoa = editar a ficha (vira Transferência no histórico); saída = Situação *Baixado* com motivo; uma campanha por unidade por ano.

## Dicas de campo
- Atalho no celular: abra `…/#patrimonio` e use *Adicionar à tela inicial*. No celular o menu aparece no ícone ▥ do topo.
- Leitura: 10 a 15 cm da placa, com o código de barras dentro da faixa. Lanterna aparece se o celular tiver.
- Código riscado: digite o número no campo abaixo da câmera.
- Fotos são reduzidas para ~1100 px antes de subir (bucket privado `patrimonio`).

## Publicar
1. Supabase → SQL Editor → rode `supabase/migrations/20261124000015_patrimonio.sql`.
2. `git add . && git commit -m "Patrimônio" && git push` (o GitHub Actions publica).
