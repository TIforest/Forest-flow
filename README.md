# Forest Flow

Aplicativo de planejamento semanal com React, TypeScript, Cloudflare Workers e D1.

[Aplicação publicada](https://forest-flow.forestpaper.workers.dev).

## Acesso corporativo

A única forma de entrar é **Entrar com a Microsoft**, usando uma conta membro do tenant Forest Paper. Contas pessoais, convidados e outras organizações são rejeitadas no servidor. A identidade usa o par imutável tenant ID + object ID; nome, cargo e e-mail não concedem permissões.

O administrador principal é Bruno Rech. O bootstrap está fixado ao objeto corporativo verificado no código do servidor, e não ao primeiro login nem ao endereço escrito no e-mail. Outras pessoas preenchem um formulário após o primeiro login, com nome, cargo, setor e, opcionalmente, unidade e observações. O e-mail é confirmado pela Microsoft. As informações chegam à seção Solicitações de acesso do painel, com contador de pendências no botão Administração. O administrador pode aprovar escolhendo o setor e a função, ou solicitar correção com uma mensagem. O cadastro não concede permissões por si só. A aprovação substitui participações provisórias pelo setor explicitamente escolhido; setores adicionais podem ser associados depois. Acessos já liberados antes dessa implementação são preservados. O administrador libera o acesso, associa a um ou mais setores e escolhe a função de membro ou coordenador em cada um. Grupos do Entra e atributo de departamento não são usados nesta versão: a fonte de autorização é o cadastro administrativo do Forest Flow.

Coordenadores administram atividades apenas nos próprios setores. A administração global permite gerenciar todos os setores; não existe promoção para administrador pela interface. Bloqueios e remoções de participação são conferidos no D1 em cada operação. O navegador atualiza a lista de permissões a cada minuto; uma tela já carregada pode permanecer visível até essa atualização, mas suas requisições são negadas imediatamente.

## Configuração manual do Entra ID

1. Abra o registro do aplicativo no Microsoft Entra ID. Use **somente contas deste diretório organizacional**, plataforma **Web**.
2. Client ID: 98042fb3-4213-4b41-88fd-9587d2726d29. Tenant ID: 0275c0a9-897a-4be2-8fa3-ec49e3be273d.
3. Cadastre estes retornos Web exatamente:
   - Produção: https://forest-flow.forestpaper.workers.dev/api/auth/microsoft/callback
   - Local: http://localhost:5180/api/auth/microsoft/callback
4. Permissões delegadas Microsoft Graph: **User.Read**, além dos escopos OpenID **openid**, **profile**, **email**. Não são necessárias permissões de leitura de todos os usuários/grupos, nem offline_access. Conceda consentimento administrativo se a política corporativa exigir.
5. Crie o segredo do cliente e configure o **valor** em ENTRA_CLIENT_SECRET, exclusivamente no servidor. Não use o identificador do segredo e não o coloque no frontend, Git ou chat. Anote a expiração e renove antes de vencer.
6. Configure ENTRA_TENANT_ID, ENTRA_CLIENT_ID e ENTRA_REDIRECT_URI no ambiente correspondente. O endereço de retorno deve ter a mesma origem do app; no desenvolvimento use **localhost**, não 127.0.0.1.

O servidor usa Authorization Code + PKCE, state e nonce, transação de uso único vinculada ao navegador, validação de assinatura RS256 com as chaves Microsoft, issuer/audience/expiração e tenant. Consulta /me com User.Read e rejeita convidados e provedores de identidade externos. Tokens Microsoft são usados apenas durante o login; não são enviados ao frontend ou guardados no D1. A sessão do aplicativo é opaca, com apenas o hash no banco e cookie HttpOnly, Secure em produção e SameSite=Lax. Expira em oito horas ou após dez minutos sem atividade. As escritas exigem Origin da própria aplicação.

## Desenvolvimento

Instale Node.js e execute na pasta do projeto:

```powershell
npm.cmd install
# Copie .dev.vars.example para .dev.vars e configure o segredo localmente.
npm.cmd run db:migrate
npm.cmd run dev
```

Abra http://localhost:5180. O login local utiliza a mesma conta Microsoft, mas o banco local é independente da produção. Não há acesso de demonstração por cabeçalho nem login com senha própria.

Verificações:

```powershell
npm.cmd run typecheck
npm.cmd run test:corporate-auth
npm.cmd run test:import-parser
npm.cmd run build:production
```

O teste corporativo usa SQLite em memória, chaves RSA e respostas Microsoft simuladas. Testa assinatura/claims, state/nonce/PKCE, replay, contas não autorizadas, setores, coordenação, revogação, importação, vínculo histórico e preservação dos dados. Não substitui o primeiro login interativo real no tenant, que depende das políticas de consentimento/MFA do Entra.

## Migração e preservação

Antes de aplicar 0011, exporte o D1 para um arquivo privado, fora do repositório. A migração é aditiva: cria identidades, setores, participações, sessões corporativas, transações OAuth e auditoria. As tarefas e importações existentes ficam no setor TI. Os perfis antigos e suas participações são preservados, porém ficam pendentes até receberem uma identidade corporativa e autorização. As sessões antigas são invalidadas. Tabelas de senhas antigas permanecem sem uso para facilitar recuperação; nenhuma rota aceita essas credenciais.

Depois do primeiro login e do envio do formulário de cada pessoa:

1. No painel **Administração**, confira a identidade Microsoft e o Object ID.
2. Em **Gerenciar → Opções avançadas → Vincular perfil antigo**, escolha explicitamente o perfil histórico da pessoa. Nunca confie só na semelhança de nome ou no e-mail antigo.
3. Analise a solicitação recebida e aprove com o setor e a função autorizados. Associe outros setores no painel Gerenciar acesso, se necessário.

O vínculo move a identidade e as sessões para o ID histórico, mantendo tarefas, comentários, checklists, responsáveis e eventos. O registro provisório fica marcado como mesclado. Se o perfil novo já tem tarefas, o vínculo é recusado para evitar perda de vínculos: revise os dois históricos manualmente. Bloquear uma pessoa invalida suas sessões; desativar um setor preserva todos os dados.

Publicação:

```powershell
npx.cmd wrangler secret put ENTRA_CLIENT_SECRET --config deployment/wrangler.jsonc
npm.cmd run db:migrate:remote
npm.cmd run deploy
```

A migração 0011 marca todas as atividades históricas como TI. Antes de reverter uma versão após criar outros setores, prepare uma recuperação que mantenha o isolamento: versões antigas não conhecem setores nem a nova autorização. Não publique um Worker antigo sobre o banco migrado sem essa revisão.

## Importação de atividades

Importação por texto, sem IA. Aceita listas do Teams, nomes, prefixos de conversa, listas numeradas e texto livre. Mantém prévia editável antes de criar cartões; identifica datas explícitas/relativas e participantes cadastrados no setor. O prazo padrão é sete dias a partir da importação. Termos ambíguos e pessoas não reconhecidas exigem revisão.

O quadro mantém Em andamento, Bloqueado e Concluído. Arrastar para Bloqueado abre o motivo com foco. Comentários, checklist e histórico acompanham a tarefa quando ela é continuada em outra semana.

## Diagnóstico do login Microsoft

As falhas após uma transação OAuth válida recebem uma referência e são registradas em auth_login_failures por até sete dias (máximo de 500 registros). São persistidos somente referência, etapa, códigos de erro e horário. Não são guardados e-mail, token, código de autorização, segredo, resposta completa ou URL de retorno. Erros de correlação sem transação válida recebem uma mensagem de sessão expirada, sem gravar uma linha no banco.

AADSTS7000215 indica que a Microsoft recusou o segredo usado no servidor. No registro do aplicativo, em Certificados e segredos, copie o campo **Valor** do segredo, não seu **ID**. Se o valor não estiver mais disponível, crie um novo segredo e configure-o pelo prompt interativo do Wrangler, sem colá-lo em argumentos do comando, no chat ou no Git:

```powershell
npx.cmd wrangler secret put ENTRA_CLIENT_SECRET --config deployment/wrangler.jsonc
```

Essa alteração atualiza o segredo em produção sem exigir novo build do frontend. Para desenvolvimento, configure separadamente ENTRA_CLIENT_SECRET em .dev.vars. Após configurar, teste um novo login completo pelo botão Microsoft; não reutilize URLs antigas de retorno.

## Exclusão permanente de perfis

Em Administração → Usuários → Gerenciar, o administrador pode clicar em Excluir perfil no fim do painel lateral. A confirmação mostra os vínculos existentes e exige digitar o nome completo. O perfil, a identidade Microsoft, as sessões, as participações, o formulário e as credenciais antigas vinculadas ao ID são removidos do banco. Tarefas, comentários, etapas e históricos permanecem; as referências à pessoa passam a uma identificação interna sem acesso, chamada Usuário excluído. O conteúdo livre de comentários e descrições é preservado e não passa por remoção automática de nomes escritos no texto.

A exclusão ocorre em uma transação: se algum vínculo impedir a operação, nenhuma alteração é aplicada. O administrador principal e a identificação histórica não podem ser excluídos. Uma pessoa excluída que volte a entrar com a Microsoft gera um novo cadastro pendente, sem recuperar as permissões anteriores. Para impedir futuras solicitações, utilize Bloquear em vez de excluir.

## Layout da administração

A página Administração organiza os recursos nas abas Usuários, Solicitações e Setores. Usuários contém busca por nome/e-mail/cargo e filtros de setor e status. Gerenciar abre um painel lateral com as participações e a função em cada setor; Salvar alterações aplica a função ao setor selecionado. Bloqueio, reabertura de cadastro e exclusão permanecem protegidos pelas regras do servidor. O vínculo de perfis antigos está em Opções avançadas. O histórico fica no cabeçalho e também pode ser filtrado pela pessoa no painel lateral.

Solicitações reúne a análise de cadastros, com filtros de pendentes, aprovadas e correções solicitadas. Setores permite criar, renomear, desativar/reativar e abrir a lista de pessoas do setor. A navegação lateral retorna diretamente a Minha semana, Equipe ou Reunião semanal.

## Administração por setor e administradores adicionais

Coordenadores de setores ativos também veem Administração, limitada à aba Usuários. O servidor retorna somente pessoas, participações e registros de participação/cargo dos setores que coordenam. A pessoa pode coordenar vários setores. Solicitações, criação/edição de setores, bloqueio global, exclusão, vínculo de identidades e definição de coordenadores/administradores continuam exclusivos do administrador global.

Em **Adicionar integrante**, o coordenador pesquisa por pelo menos dois caracteres do nome ou e-mail de pessoas com login Microsoft e cadastro aprovado. A pesquisa retorna somente ID, nome e e-mail (até 20 resultados), sem revelar suas participações ou solicitações de outros setores. A inclusão concede apenas a função de membro. **Remover deste setor** preserva o perfil, atividades e participações em outros setores. Coordenadores não podem alterar a si mesmos, outros coordenadores do setor nem administradores. Todas as mutações são verificadas no servidor; acesso revogado ou setor desativado deixa de autorizar a operação.

O **Cargo neste setor** é separado do cargo global. A migração aditiva **0014_sector_member_profiles.sql** cria a tabela de cargos vinculada à participação, sem modificar as tarefas nem os perfis existentes. Cargo vazio utiliza o cargo global. A remoção da participação elimina somente esse cargo local e mantém os registros de auditoria.

Administradores globais encontram **Papel no sistema** no painel Gerenciar acesso de uma pessoa aprovada. Escolher Administrador do sistema exige marcar a confirmação e salvar. A concessão dá acesso a todos os setores, solicitações e gestão de administradores. A retirada preserva as participações e suas funções por setor. Não é possível retirar o próprio acesso administrativo nem o do administrador principal fixado por tenant e Object ID; a atualização atômica também protege a existência de outro administrador ativo. Alterações ficam registradas no histórico e valem nas requisições seguintes, sem exigir novo login Microsoft.

Antes de publicar esta versão, aplique a migração 0014 no D1 correspondente. O teste corporativo cobre a administração limitada, tentativas de alterar outros setores, promoção indevida, busca de pessoas aprovadas, cargo local, auditoria, coordenação de vários setores, concessão/retirada de administração e revogação.

## Fotos Microsoft

A migração aditiva 0015 adiciona uma miniatura ao perfil. Durante o login, o servidor consulta `/me/photos/96x96/$value` no Microsoft Graph com o token delegado já utilizado para o perfil. Guarda somente a imagem JPEG/PNG (até 64 KiB), sem persistir tokens. Foto ausente (404) remove a miniatura; falhas temporárias mantêm a última foto e não impedem o login. As imagens são retornadas apenas nas consultas autenticadas já limitadas por setor ou pela administração global.

Cada pessoa precisa sair e entrar novamente pela Microsoft para sincronizar sua própria foto pela primeira vez. As demais pessoas passam a vê-la no quadro e na administração com a atualização automática. As mudanças posteriores de foto sincronizam no próximo login. Contas sem foto continuam mostrando iniciais. Perfis históricos não vinculados à Microsoft não têm foto corporativa. Não há consulta em massa ao diretório nem credenciais Microsoft adicionais.

## Títulos únicos de atividades

Criação manual, edição e importação recusam títulos repetidos no mesmo setor, entre todos os responsáveis e semanas, inclusive concluídos. A chave usa Unicode NFKD, remove marcas de acento, converte para minúsculas e agrupa espaços; pontuação permanece significativa. Cartões excluídos liberam o título. A prévia desmarca títulos já existentes ou repetidos no lote; a confirmação revalida o lote inteiro. Um índice único no D1 protege também contra solicitações simultâneas e a transação de importação impede criação parcial.

Aplique 0016_unique_task_titles.sql e execute `node scripts/backfill-task-title-keys.mjs --remote` (sem `--remote` para o banco local). Faça backup antes: o preenchimento preserva os cartões e seus vínculos, mas diferencia duplicados legados com sufixos `(2)`, `(3)` etc., mantendo o título do mais antigo. O script reserva títulos já usados para evitar novas colisões, limita o título a 180 caracteres e só atualiza linhas que ainda correspondem ao título/setor lidos. Reexecute após a publicação se houver escritas durante a transição. Não cria cópias de tarefas. Para retomar uma atividade em outra semana, utilize a continuidade do cartão existente.

## Notificações e Web Push

O sino abre a central individual (até 100 avisos não lidos), contador de não lidas e leitura individual/em lote. O conteúdo é filtrado pelo acesso atual ao setor e à tarefa. São registrados: atribuição de atividades e novos participantes (inclusive importações), comentários, mudanças de status, envio/reenvio de cadastro aos administradores e decisão de aprovação/correção ao solicitante. A própria ação não gera aviso para seu autor. As gravações de avisos e a alteração de origem usam a mesma transação. Importações repetidas não criam novos avisos.

Depois da publicação, cada pessoa deve clicar no sino → **Ativar avisos neste navegador** e permitir no Chrome/Edge/Firefox compatível. A autorização é solicitada somente após esse clique. A central funciona mesmo sem permissão de sistema. A inscrição é individual por navegador/dispositivo. **Desativar avisos neste navegador** remove a inscrição. Sair da conta invalida no servidor as inscrições vinculadas à sessão que saiu; ao entrar novamente, a opção anteriormente ativada é restabelecida quando o navegador ainda permite avisos.

Web Push funciona com a aba fechada, conforme suporte/configuração de execução em segundo plano e notificações do navegador e do sistema operacional. Não garante aviso com computador desligado, sem rede, navegador encerrado sem serviço em segundo plano ou com notificações bloqueadas. O aviso externo é genérico e não contém nome de tarefa, comentário ou dados do cadastro; os detalhes são consultados no site após autorização. O clique abre a atividade/semana ou a área de solicitações. Se a sessão expirou, é necessário entrar de novo e consultar a central.

A migração aditiva 0017 cria notificações, inscrições e fila de entrega. O servidor usa Web Crypto com ECDH/HKDF/AES-128-GCM (RFC 8291) e assinatura VAPID ES256; nenhuma biblioteca Node ou token Microsoft é necessária para enviar. Configure `VAPID_PUBLIC_KEY` (ponto P-256 não comprimido em base64url) e `VAPID_PRIVATE_KEY` (parâmetro privado `d` de JWK P-256) como segredos do Worker. Não gere novas chaves a cada deploy: a troca exige reinscrição dos navegadores. A chave privada nunca vai para o frontend. O cliente recebe apenas a pública. O contato VAPID é `mailto:ti@forest.ind.br`.

O envio começa em `waitUntil` após escritas bem-sucedidas. Um Cron Trigger a cada minuto retoma a fila sem depender de páginas abertas. Há bloqueio temporário por entrega, até cinco tentativas com espera progressiva, eliminação de inscrições 404/410 e nova validação de acesso antes de enviar. Endpoints são restritos aos provedores Web Push conhecidos, sem redirecionamentos. A fila cobre avisos não lidos das últimas 24 horas e não reenvia entregas já aceitas pelo provedor; notificações da central são removidas depois de 90 dias. Notificações anteriores à ativação do navegador não são enviadas retroativamente. A entrega final ainda depende do provedor/navegador, e uma aceitação HTTP não comprova que o usuário visualizou o aviso.

Execute `npm.cmd run test:web-push` para conferir criptografia e assinatura de forma independente, e `npm.cmd run test:corporate-auth` para os testes de isolamento, inscrições, leitura, fila, repetição e revogação. Uma confirmação de entrega real no sistema operacional requer um navegador inscrito e a permissão concedida pelo usuário. Dados de teste não são publicados.

### Diagnóstico de entrega

A API autenticada de diagnóstico permite testes para a própria conta e o navegador inscrito, limitada a um pedido a cada 30 segundos. O botão de teste foi retirado da interface de uso normal. O status técnico distingue aceitação pelo provedor de falha de transporte; aceitação não equivale a exibição na tela. A migração 0018 adiciona `last_error` às tentativas, com etapa, status HTTP ou nome de erro permitido. Não registra URL de inscrição, chaves, token VAPID nem resposta bruta do provedor.

O transporte usa `redirect: 'manual'` e rejeita HTTP 3xx. O runtime do Cloudflare Workers rejeita `redirect: 'error'` com TypeError antes de enviar a requisição, embora Node.js aceite esse modo. Além dos testes Node, valide alterações de transporte no runtime Workers.

### Leitura e destino dos avisos

A central mostra apenas notificações não lidas. Clicar marca como lida, remove da lista e abre o cartão na semana correspondente ou Administração → Solicitações para pedidos de entrada. Marcar todas como lidas esvazia a central. O registro não é excluído, permanecendo sujeito à retenção de 90 dias. O endpoint individual confere titular e acesso atual, permitindo resolver um aviso antigo do navegador mesmo se já foi lido ou saiu do limite de 100 avisos. Identificadores recebidos pelo navegador são preservados na sessão do navegador durante o login, e novamente autorizados após entrar. Avisos técnicos sem um destino de atividade são apenas lidos e removidos da central. Desativar avisos fica como ação discreta no rodapé direito; a ativação continua disponível para quem ainda não habilitou Push.

### Lembretes de prazo

O Cron também gera lembretes diários a partir de 08:00, no fuso America/Sao_Paulo. Considera o prazo do cartão em qualquer semana de planejamento: faltando dois dias, amanhã, hoje ou atrasado. A central inclui título da tarefa e dias corridos de atraso; o Push externo informa genericamente prazo próximo/atraso. Clicar abre o cartão pela mesma navegação dos outros avisos.

A migração aditiva 0019 grava a data do lembrete e o prazo considerado, com unicidade por responsável/tarefa/dia. O Cron roda a cada minuto, mas não repete o aviso no mesmo dia, inclusive depois de lido. No dia seguinte, lê o aviso anterior quando cria o novo, para não acumular alertas antigos. Após uma implantação durante o dia ou criação de tarefa após 08:00, o primeiro lembrete pode ser gerado na próxima execução. Todos os responsáveis e participantes designados são considerados; o coordenador não recebe apenas por ser coordenador.

Não são gerados avisos para cartões concluídos/excluídos, setores desativados ou responsáveis bloqueados, pendentes ou sem acesso ao setor. Antes de mostrar/enviar, o servidor confirma a responsabilidade atual, o prazo e o status. Um prazo alterado invalida o lembrete antigo; se já houve lembrete no mesmo dia, outro só será gerado no dia seguinte. Desativar Push no navegador não impede a central. O teste `npm.cmd run test:deadline-reminders` cobre horário, prazos, atraso, múltiplos responsáveis, exclusões, repetição, renovação diária e supressão de avisos desatualizados.
