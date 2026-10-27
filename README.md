# Forest Flow

Planejamento semanal da TI da Forest Paper: React, TypeScript, Tailwind, Cloudflare Workers e D1.

## Aplicação publicada

https://forest-flow.bruno-rech.workers.dev

D1 remoto: `forest-flow`. A configuração está em `deployment/wrangler.jsonc`.
Os integrantes e as tarefas locais existentes foram copiados para o remoto em 27/10/2026, sem contas/sessões e sem registros temporários de teste. Os dois bancos são independentes; alterações posteriores no ambiente local não sincronizam automaticamente com produção.

## Login da equipe e perfis

A entrada usa exclusivamente **ti@forest.ind.br** e uma senha compartilhada. Após entrar, cada pessoa escolhe um perfil por nome, cargo e cor. O botão **Trocar perfil** volta à seleção sem exigir novamente a senha. O cadastro individual foi desativado.

Todos com a senha podem selecionar qualquer perfil, inclusive a coordenação, conforme a política definida pela equipe. As permissões seguem o perfil selecionado; os registros indicam esse perfil e não comprovam a identidade da pessoa. As tarefas restritas também podem ser acessadas ao selecionar o perfil autorizado.

Para definir ou trocar a senha da equipe em produção, execute no terminal da pasta do projeto:

```powershell
npm.cmd run account:setup
```

O comando solicita senha e confirmação sem exibi-las (8 a 128 caracteres), grava somente salt e hash PBKDF2-SHA256 e encerra as sessões existentes. Não use a senha do Microsoft 365; defina uma senha própria para o Forest Flow. Para desenvolvimento local, use `npm.cmd run account:setup:local` após aplicar as migrações.

Os perfis, tarefas e contas individuais históricas são preservados. As contas e sessões antigas não autenticam mais. As sessões da equipe duram 8 horas, usam cookies HttpOnly/SameSite=Strict/Secure em produção, exigem escolha de perfil no servidor e renovam seu token na troca de perfil. Não existe cadastro público da senha compartilhada.

## Fluxos implementados

- Minha semana, quadro da equipe, busca e filtros por responsável.
- Cores configuráveis por integrante e gestão de cargo e perfil pela coordenação.
- Atividades em andamento, bloqueadas ou concluídas, criadas na semana atual iniciada no domingo.
- Colaboradores criam atividades para si; coordenadores delegam para qualquer integrante.
- Coordenadores editam título, descrição, responsável, prazo, prioridade e visibilidade. Colaboradores editam título e descrição das tarefas que criaram e que continuam atribuídas a eles.
- Responsável e coordenação atualizam status. Arrastar para Bloqueado abre o motivo já com foco. Enter salva, Shift+Enter insere nova linha. Alternativa ao arraste: espaço, setas, Enter; Escape cancela.
- Exclusão com confirmação e preservação do histórico. Colaboradores excluem somente tarefas que criaram para si; a coordenação pode excluir qualquer tarefa.
- Comentários em atividades visíveis ao integrante, com autor e horário. Enter envia e Shift+Enter insere nova linha. Atividades restritas mantêm comentários e histórico restritos.
- Histórico de criação, alterações, exclusão e continuidade semanal.

## Continuidade das semanas

Na aba **Reunião semanal**, a coordenação pode selecionar tarefas não concluídas da semana anterior para incluir na semana selecionada e preparar as tarefas da próxima semana. A mesma tarefa passa a constar dos planejamentos escolhidos: ID, prazo, comentários e histórico são mantidos. Repetir a operação não duplica a tarefa.

A semana original fica preservada em `tasks.week`; a participação em cada planejamento está em `task_weeks`. A reunião mostra o estado atual da tarefa, não uma fotografia imutável do status em uma reunião anterior. Não há ata automática.

## Desenvolvimento local

Requer Node.js 24 ou superior e npm. Clone o repositório e abra a pasta no VS Code:

```powershell
git clone https://github.com/TIforest/Forest-flow.git
cd Forest-flow
```

Na pasta do projeto:

```powershell
npm.cmd install
Copy-Item .dev.vars.example .dev.vars
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run account:setup:local
npm.cmd run dev
```

Acesse a URL indicada no terminal, normalmente http://127.0.0.1:5173. Entre com ti@forest.ind.br e a senha local definida no passo account:setup:local, e selecione o perfil. As contas locais são independentes das de produção.

A seleção de perfis aparece após o login compartilhado. `LOCAL_DEMO=true` permite exclusivamente em loopback o cabeçalho de identidade usado pelos testes automatizados legados; ele não é incluído na configuração de produção. O código da interface usa cookies de sessão, não esse cabeçalho.

## Verificações

```powershell
npm.cmd run typecheck
npm.cmd run format:check
npm.cmd run test:api
npm.cmd run test:members
npm.cmd run test:shared-login
```

A suíte test:shared-login usa o servidor local na porta 5183 (ou TEST_BASE_URL), com migrações aplicadas e sem credencial compartilhada configurada. Cria e remove seus perfis e credencial de teste. Valida login, seleção, troca de perfil, bloqueio sem perfil e logout. Os testes legados test:api e test:members usam LOCAL_DEMO=true e dados de demonstração na porta 5173.

## Publicação

```powershell
npm.cmd run db:migrate:remote
npm.cmd run deploy
```

O build de produção usa `deployment/wrangler.jsonc`, separado do D1 local. Não executa o seed de demonstração no remoto nem inclui `.dev.vars` local. Não é necessária nenhuma configuração de envio de e-mails.

## Organização

- `src/`: interface e componentes de autenticação, comentários, equipe e continuidade.
- `worker/`: API e autenticação, com validações e SQL parametrizado.
- `migrations/`: estrutura versionada do D1.
- `scripts/`: build e testes de integração.
- `deployment/`: configuração remota.

## Importação de texto

No perfil de coordenação, use **Importar texto**. Cole o planejamento, prepare a prévia, revise e confirme. A importação usa exclusivamente o servidor do Forest Flow, sem IA, chaves, créditos ou serviços externos.

Formato: uma linha com 👤 Nome define o responsável; cada linha de atividade após o nome cria um cartão, com ou sem marcador -; tópicos com recuo maior viram checklist da tarefa anterior. Linhas vazias são ignoradas, assim como diferenças de caixa e acentuação nos nomes. Títulos são preservados integralmente. Status inicial Em andamento, prioridade Normal e prazo padrão de 7 dias corridos a partir da data da importação no fuso America/Sao_Paulo (segunda → próxima segunda). O prazo aparece na prévia e pode ser alterado antes da confirmação. A semana é a selecionada no quadro; ela não muda o cálculo do prazo.

Nomes são associados por correspondência exata ou início do nome completo, apenas quando há um único resultado. Nomes ausentes ou ambíguos exigem escolha na prévia. A importação não cadastra pessoas. Linhas sem marcador antes de um cabeçalho de responsável são sinalizadas para revisão. Limites: 20.000 caracteres, 50 cartões, 180 caracteres por título, 30 etapas por cartão e 300 caracteres por etapa. Limites excedidos interrompem a preparação, sem cortar textos ou salvar tarefas parcialmente.

A prévia permite editar título, responsável, descrição, prazo, prioridade, status e checklist, além de desmarcar cartões. Alertas de duplicação comparam título normalizado e responsável entre as atividades existentes na semana. A confirmação grava tarefas, etapas, vínculos semanais e eventos em um lote atômico; o ID de importação impede repetir a mesma confirmação. Os dados históricos de importações anteriores são preservados.

O checklist pode ser atualizado pelo responsável ou coordenação, respeitando a visibilidade de tarefas restritas e registrando histórico. Testes: `npm.cmd run test:import-parser` valida o exemplo de 21 cartões e o formato; `npm.cmd run test:import-api` usa o servidor local na porta 5184 com LOCAL_DEMO=true, cria e remove apenas seus dados de teste e verifica prévia, confirmação, permissões e checklist.
