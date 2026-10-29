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
2. Em **Vincular perfis antigos**, escolha explicitamente o perfil histórico da pessoa. Nunca confie só na semelhança de nome ou no e-mail antigo.
3. Analise a solicitação recebida e aprove com o setor e a função autorizados. Associe outros setores em Participação nos setores, se necessário.

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

Em Administração → Pessoas e liberação de acesso, o administrador pode clicar em Excluir perfil. A confirmação mostra os vínculos existentes e exige digitar o nome completo. O perfil, a identidade Microsoft, as sessões, as participações, o formulário e as credenciais antigas vinculadas ao ID são removidos do banco. Tarefas, comentários, etapas e históricos permanecem; as referências à pessoa passam a uma identificação interna sem acesso, chamada Usuário excluído. O conteúdo livre de comentários e descrições é preservado e não passa por remoção automática de nomes escritos no texto.

A exclusão ocorre em uma transação: se algum vínculo impedir a operação, nenhuma alteração é aplicada. O administrador principal e a identificação histórica não podem ser excluídos. Uma pessoa excluída que volte a entrar com a Microsoft gera um novo cadastro pendente, sem recuperar as permissões anteriores. Para impedir futuras solicitações, utilize Bloquear em vez de excluir.
