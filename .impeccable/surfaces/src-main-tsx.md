---
version: 1
slug: "src-main-tsx"
primary_target: "src/main.tsx"
related_targets: ["src/AuthGate.tsx","src/styles.css","src/Members.tsx","src/ImportTasks.tsx"]
---

# Forest Flow — casca do app (login, perfis, quadro, reunião, integrantes, painel, importação)

Modo: Operate. Quem usa: 4 pessoas da TI no próprio PC, o dia inteiro; coordenação conduz a reunião semanal a partir do quadro. Tarefa: ver/mover as próprias atividades da semana; delegar; continuar semanas. Conteúdo real: 14 atividades da semana de 25/10/2026. Restrições: API, banco, permissões e textos funcionais intocados; sem serviço externo em runtime (fonte Sora self-hosted); sem logo da empresa (marca própria do app).

Brief do usuário (27/10/2026, pinado): visual moderno/tecnológico/sofisticado com presença; profundidade, luz ambiente, painéis de vidro na casca com superfícies opacas onde se lê; entradas escalonadas 8–16 px + opacidade; hover com elevação; luz seguindo o cursor em cartões de destaque; tilt 3D pequeno só em elementos apropriados; indicador de navegação animado; modais/painéis com fundo e conteúdo coordenados; estados completos; prefers-reduced-motion; e uma interação marcante tipo "luminária que acende e revela o formulário".

## Direction contract

THESIS: Luz na fábrica à noite. O quadro é uma sala petróleo onde a luz limão é escassa e sempre significa algo (ação, estado ativo, confirmação); vidro só na casca, papel opaco onde se lê. Recusa o kanban cinza-claro de SaaS e o dark-mode com neon espalhado por todo canto.

OWN-WORLD: chão #0A252A com profundidade (gradiente radial escuro + duas luzes ambiente lentas: limão 6 %, roxo 6 %, 40 s, pausadas fora de vista). Casca em vidro: branco 5 % + blur 18 px + borda 1 px branco 10 % (trilho, topo, faixa de resumo). Cartões e formulários opacos #103A41 → #0C2A30 com texto branco e secundário tintado do verde (#9FB8B4). Limão #C5F249 = ação primária, aba ativa, luz, foco. Kraft #B19873 = bloqueio/atenção, sempre aceso enquanto durar. Roxo #C1B4EE = coordenação e restrito. Uma tinta por status: andamento = limão, bloqueado = kraft, concluído = roxo, usada em cabeçalho, selo, resumo e painel. Sora (variável, self-hosted) única família, números tabulares; lucide 1.75 px; raios 12 (painéis) / 10 (cartões) / 8 (controles) / 999 (chips); hairlines de 1 px, sombras com offset e blur. Cor do responsável como "ímã" (pílula 22×6) no canto do cartão + avatar sólido, nunca borda grossa.

STORY: a pessoa entra numa sala escura; a senha acende a luminária e os perfis aparecem; ao escolher quem é, a luz toma a cor dela e o quadro se monta na frente dela (trilho, topo, resumo, cartões, em sequência). Daí em diante cada ação responde com luz: mover para Concluído pulsa a placa, bloquear acende o kraft, salvar confirma no botão.

FIRST VIEWPORT (1440×900): Login — sala petróleo com uma luminária (a marca: haste fina + cúpula limão apagada) pendurada sobre o cartão; formulário visível em penumbra (campos escuros, rótulos tintados); ao autenticar a cúpula acende (600 ms), um cone de luz desce sobre o cartão e os perfis surgem escalonados (50 ms). App — trilho de vidro 236 px à esquerda: marca, "Tecnologia da Informação" como rótulo do workspace, 4 abas com indicador limão deslizante, perfil + Trocar perfil/Sair embaixo. Topo: título da aba (Sora 600, 28 px) com contagem em frase, seletor de semana em vidro, "Importar texto" fantasma e "Nova atividade" como a única superfície limão sólida. Faixa de resumo em vidro com 4 números (34 px, tabulares, contagem animada na montagem). Três colunas: placa de status (ícone + nome + contagem, tinta do status), cartões opacos escalonados 50 ms, "Adicionar atividade" tracejado. Painel lateral da tarefa: fundo escurece e o painel desliza 24 px em 260 ms, campos opacos com foco limão.

FORM: Mural de Gestão à Vista (posição 1 da minha lista) fundido com o brief pinado do usuário (vidro + profundidade + luminária). O sorteio apontou a posição 6 (Sinalização de Fábrica); o brief do usuário sobrepõe o sorteio, e dela ficam: uma tinta por status em todo lugar, números tabulares, bloqueio aceso em kraft, hairlines de 1 px. Interação-assinatura: "Acender a sala" (login → perfil → montagem do quadro). Gramática de movimento: ease-out exponencial; 160 ms feedback, 260 ms painéis/menus, 600 ms acender; escalonamento 50 ms; entrada só na montagem, nunca em atualização de dados; prefers-reduced-motion desliga tudo. seed:eb030066d22ebe85

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
