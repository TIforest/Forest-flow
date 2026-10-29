# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Equipe de TI da Forest Paper: hoje 4 pessoas (1 coordenador, analista, assistente, estagiário). Cada um abre o Forest Flow no próprio PC durante a semana para ver e mover as próprias atividades; a coordenação delega, importa o planejamento e conduz a reunião semanal a partir dele. Confirmado em 27/10/2026: o uso é no desktop de cada um (não é projetado nem usado no celular), e a intenção seguinte é publicar uma versão para cada setor da empresa — a TI é o primeiro workspace, não o único.

## Product Purpose

Quadro de planejamento semanal da equipe. Mostra o que cada pessoa está fazendo nesta semana, o que travou e o que foi entregue, e liga uma semana à seguinte sem perder histórico. Sucesso: a reunião semanal acontece em cima do quadro, sem planilha paralela, e cada integrante sabe o que é dele sem perguntar.

## Positioning

Uma semana por vez, por pessoa, com continuidade real: a mesma tarefa é carregada para a semana seguinte mantendo ID, prazo, comentários e histórico (não é cópia). Importação do planejamento colado em texto, sem IA nem serviço externo. Login corporativo Microsoft Entra ID, com liberação de acesso e setores gerenciados pelo administrador no Forest Flow.

## Operating Context

- Semana começa no domingo; o quadro tem três estados: Em andamento, Bloqueado (exige motivo), Concluído.
- Abas: Minha semana, Equipe (quadro completo com filtro por responsável), Reunião semanal (semana anterior × compromissos desta semana, com "continuar" e "preparar próxima"), Integrantes (só coordenação), Importar texto (só coordenação).
- Por tarefa: título, descrição, responsável, prazo, prioridade (Normal/Alta), restrita (coordenação + responsável), checklist, comentários, histórico de eventos.
- Cada integrante tem uma cor que identifica seus cartões no quadro.
- Infra: React 19 + TypeScript + Vite, CSS puro em `src/styles.css` (Tailwind 4 importado mas quase não usado), lucide-react; Cloudflare Worker + D1; deploy via `deployment/wrangler.jsonc`.

## Capabilities and Constraints

- A migração corporativa adiciona autenticação Microsoft e autorização por setor. Funcionalidades de planejamento, importação e colaboração devem ser preservadas.
- Fontes e ícones são servidos pelo próprio app. Microsoft Entra ID/Graph são usados somente para autenticação; importação permanece sem IA.
- A identidade é individual e vem da Microsoft. Novos colaboradores informam nome, cargo e setor em um formulário; o administrador analisa a solicitação e autoriza o setor e a função. Unidade e observações são opcionais. Pedidos de correção permitem reenvio.
- Multi-setor implementado com isolamento no servidor: um usuário pode participar de vários espaços de trabalho.

## Brand Commitments

- Nome do produto: **Forest Flow**. Empresa: Forest Paper.
- Paleta oficial da Forest Paper (PDF "1920x1080_Forest_coresRGB"): Verde Escuro `#0A252A`, Verde Claro `#C5F249`, Bege Kraft `#B19873`, Roxo Destaque `#C1B4EE`. Bruno autorizou (27/10/2026) trocar tudo que não é original da marca — o verde `#24563e` do site atual não é.
- Marca do app: símbolo próprio do Forest Flow criado dentro da paleta; não existe arquivo de logo da empresa para usar e não se deve fingir que é o logo corporativo.

## Evidence on Hand

- Produção real com 14 atividades da semana de 25/10/2026 e 4 integrantes (capturas em `C:\Users\BRUNOC~1\AppData\Local\Temp\claude\C--Users-BrunoCarvalho-Forest\a012f932-fbdb-424f-b427-1a48344129b3\scratchpad\`).
- Dados de demonstração em `seed.sql` (4 usuários, 5 tarefas) para o ambiente local.
- Não existe logo da empresa em arquivo, nem fotos, nem depoimentos: não inventar.

## Product Principles

1. A atividade da pessoa é o centro; tudo em volta (resumo, filtros, semana) existe para chegar nela em um olhar.
2. Uma semana de cada vez, com a anterior e a próxima a um clique — nunca um backlog infinito.
3. Pronto para virar um por setor: identidade do Forest Flow, setor como rótulo.
4. Autenticação corporativa Microsoft; importação por texto sem IA.
5. Acabamento de produto, não de template: a TI está mostrando o que sabe entregar.
