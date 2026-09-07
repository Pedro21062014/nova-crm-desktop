# Changelog — Nova CRM Desktop

Todas as mudanças relevantes do aplicativo, em linguagem amigável.
Este arquivo é a fonte das "novidades da versão" exibidas no app (Configurações)
e nas release notes do GitHub. A seção da versão atual é usada como body da release.

## [2.12.1] — 2026-09-03

### 🔧 Correções
- **Seletor de Loja: dropdown com fundo transparente corrigido** — o menu de troca de loja usava uma cor que não existe no tema; agora tem fundo sólido igual aos demais painéis do app

## [2.12.0] — 2026-09-03

### 🆕 Seletor de Loja (multi-loja)
- Novo botão no topo da sidebar com a loja ativa (logo + nome)
- Troque entre suas lojas: a loja principal + qualquer sub-loja criada no CRM web
- Ao trocar de loja, TODOS os dados do app (produtos, clientes, pedidos, chat...) trocam automaticamente para a loja selecionada
- Funciona igual ao seletor do CRM web (mesma persistência)

### 🆕 Nova aba: Equipe
- **Convide colaboradores** por e-mail com cargo (Administrador, Gerente Geral, Vendedor & CRM, Estoquista & Pedidos, Atendente de Mensagens ou Personalizado)
- **Permissões granulares por módulo**: cada colaborador acessa só as abas que você liberar (pedidos, produtos, clientes, funil, propostas, tarefas, automações, vitrine, cupons, entregas, chat, equipe)
- **Presença em tempo real**: veja quem está online agora na sua equipe (sincroniza com o CRM web — aparece nos dois apps)
- Editar cargo/permissões, remover/revogar convites e copiar link de convite
- **Lojas da Equipe**: se você for convidado para uma loja de outro lojista, ela aparece no seletor de loja — clique e comece a trabalhar nela (só com as abas liberadas)

### 🔧 Ajustes
- Ao operar numa loja de equipe, as abas sem permissão somem do menu e o app volta ao dashboard se você estiver numa delas

## [2.11.1] — 2026-09-03

### 🔧 Atualização de dependências
- **Electron atualizado de 42.0.1 para 44.1.1** (a versão mais recente) — melhor desempenho, estabilidade e segurança do app
- **electron-builder atualizado de 26.8.1 para 26.15.3** (mesmo major, compatível com o Electron 44)
- **Ícone do app no instalador Windows e executável**: agora o `Nova-CRM-Setup.exe` e o atalho exibem o ícone do Nova CRM (antes era o ícone genérico do Electron)
- Sem mudanças visíveis na interface — só o motor por trás

## [2.11.0] — 2026-09-02

### 🆙 Paridade total com a criação de produtos do CRM web
- **Vender por Peso / Tamanho**: cada variação (ex: 500g, 1kg) tem nome, preço e até foto própria — no site, o preço da variação escolhida SUBSTITUI o preço principal (que fica desativado)
- **Vender por Sabor**: variações com adicional em R$ somado ao preço do produto (ex: Chocolate, Morango)
- **Adicionais**: extras pagos que o cliente pode adicionar no carrinho (ex: Chantilly, Calda)
- **Grupos de Opções Extras**: grupos com nome, obrigatório ou não, mínimo/máximo de escolhas e opções com valor adicional (ex: "Escolha o Pão" — 1 escolha obrigatória)
- **Foto 2 opcional**: segunda imagem do produto (upload ou URL) — aparece no carrossel do produto no site
- **Validade (data opcional)**: campo de data de validade no cadastro do produto
- Todas as opções aceitam **foto por variação** (enviada já comprimida, como as fotos do app)
- Fotos principais agora são comprimidas automaticamente (1024px) antes de salvar
- Tudo grava nos DOIS formatos (desktop + CRM web), igual à correção da 2.10.8 — as opções aparecem tanto no app quanto no site

## [2.10.8] — 2026-09-02

### 🔧 Correções
- **Produtos e clientes agora sincronizam COMPLETOS com o CRM web**: o desktop gravava só em formato PT (nome, preco, telefone...) e o CRM web lê só o formato canônico (name, price, phone, address) — por isso apareciam "sem dados"
- Agora cada salvamento grava os **dois formatos** (imagem do produto vai só em `imageUrl`, sem duplicar o base64)
- **Migração automática**: ao abrir Produtos ou Clientes, os documentos antigos (só PT) ganham os campos canônicos sozinhos — o catálogo existente passa a aparecer completo no CRM web sem refazer nada
- Pedidos, Pipeline, Propostas, Tarefas e Automações já usavam o formato canônico (confirmado, sem mudança)

## [2.10.7] — 2026-09-02

### 🔧 Correções
- **Salvar não trava mais sem internet**: clicar em "Salvar" offline salva **na hora na fila local** (aguarda no máximo 3s em vez de ficar travado até você cancelar) e sincroniza sozinho quando a conexão volta
- Criações (clientes, produtos, pipeline, propostas, tarefas, automações, conversas) agora usam **ID gerado localmente** — o item já nasce com identidade e não depende do servidor
- Válido em **todas as abas**: os mesmos salvamentos funcionam online (confirmado pelo servidor) e offline (salvo local + sincronização com a % que você vê no topo)

## [2.10.6] — 2026-09-02

### 🔧 Correções
- **Ping de conectividade sem gastar cota do Firebase**: o teste de internet agora usa o endpoint oficial do Google (`clients3.google.com/generate_204`) com requisição **HEAD** — resposta 204, **zero bytes** de conteúdo e zero acesso ao seu banco
- Detecção de offline continua funcionando igual (banner amarelo + sincronização com % ao reconectar)

## [2.10.5] — 2026-09-02

### 🔧 Correções
- **Detecção de falta de internet corrigida**: agora o app **pinga o próprio backend (Firebase)** a cada 10s — funciona em todas as plataformas (Windows, Linux e macOS), inclusive quando o sistema não avisa a perda de conexão
- O banner amarelo de offline agora aparece de verdade quando a internet cai (inclusive com o app já aberto)
- Ao reconectar, a verificação só considera "online" quando o backend de fato responde

## [2.10.4] — 2026-09-02

### ✨ Novo
- **Modo offline com aviso**: banner **amarelo** no topo quando não há internet, avisando que suas alterações serão **salvas localmente**
- **Sincronização automática**: ao reconectar, o banner mostra **"Sincronizando..." com a porcentagem real** do progresso (cada alteração confirmada no servidor avança a barra)
- Tudo que foi editado offline é enviado automaticamente para o Firebase quando a conexão volta

## [2.10.3] — 2026-09-02

### ✨ Melhorias
- **Novidades da versão** agora aparecem limpas em Configurações: texto organizado em tópicos, sem HTML, sem links de commit e sem o rodapé de build
- **Release notes do GitHub** geradas a partir do CHANGELOG, com descrições amigáveis em vez da lista crua de commits

## [2.10.2] — 2026-09-02

### ✨ Novo
- **Chat com anexos** — agora igual ao CRM web:
  - Imagens e arquivos **recebidos** aparecem nas conversas (antes sumiam)
  - Imagens com **zoom em tela cheia** (clique na foto) e botão de **download**
  - Documentos (PDF, Word, Excel, CSV, TXT, ZIP) aparecem como card com download
- **Enviar anexos pelo desktop:**
  - Botão de **clipe** na conversa: imagens (comprimidas automaticamente) e documentos de até **5MB**
  - Dá para enviar **só o anexo, sem texto**
  - Tudo sincroniza com o CRM web nos dois sentidos

### 🔧 Correções
- **Auto-update do AppImage**: nome do arquivo padronizado (`Nova-CRM-2.10.x.AppImage`) — fim dos erros 404 ao atualizar

## [2.10.1] — 2026-09-02

### ⚡ Performance
- Modais de **Pipeline, Propostas, Tarefas e Automações** abrem sem a travadinha (listas memoizadas)
- **Bundle inicial ~19% menor** (jsPDF agora carrega só ao gerar o PDF)

### 🔧 Correções
- Nome do AppImage no artifactName (nível Linux) para o auto-update encontrar o arquivo

## [2.10.0] — 2026-09-02

### ✨ Novo
- Abas portadas do CRM web: **Pipeline**, **Propostas & Orçamentos**, **Tarefas & Follow-ups** e **Automações**
- **Auto-update** via GitHub Releases (verificar/baixar/reinstalar pelo app)
