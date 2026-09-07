---
Task ID: 1
Agent: Main Agent
Task: Explorar repositório CRM e corrigir cupons, receita e minha loja no app Electron

Work Log:
- Explorou o repositório CRM (Pedro21062014/CRM) via web-reader para entender as estruturas
- Descobriu que cupons usam campos: code, type, value, minPurchase, usageCount, active (não codigo, tipoDesconto, etc.)
- Descobriu que receita é calculada de orders: status !== 'cancelled' para faturamento, paymentStatus === 'paid' + paymentMethod PIX/CREDIT_CARD para valor pago
- Descobriu que storeConfig é um campo aninhado no documento do merchant (não campos no nível raiz)
- Atualizou firebase.ts: Coupon, Order, OrderItem, StoreConfig interfaces com campos do CRM + compat antiga
- Reescreveu CouponsPage.tsx: helpers getCouponCode(), getCouponType(), getCouponValue(), etc. para compat com ambos formatos
- Reescreveu DashboardPage.tsx: cálculo de receita correto (status !== cancelled), 4 KPIs: Faturamento Total, Valor Pago, Vendas, Pedidos Pendentes
- Reescreveu WeeklyChart.tsx: Mostra Faturamento e Valor Pago (Pix/Cartão) em vez de Entradas/Saídas
- Reescreveu RecentOrders.tsx: Suporta status do CRM (pending_payment, new, processing, completed, cancelled)
- Reescreveu OrdersPage.tsx: Usa campos e status do CRM, summary cards atualizados
- Reescreveu useStoreConfig.ts: Lê do Firestore diretamente (onSnapshot no merchant doc), extrai storeConfig com extractStoreConfig(), salva com dot notation
- Reescreveu SettingsPage.tsx: Campos do CRM (storeName, description, whatsapp, document/pixKey, fullAddress, enableNativePayment, isOpen)
- Build: tsc + vite OK, .deb OK, Windows zip falhou (sem wine)
- Commit e push: v1.8.0, tag v1.8.0
- GitHub release criado com .deb: https://github.com/Pedro21062014/nova-crm-desktop/releases/tag/v1.8.0

Stage Summary:
- Cupons agora usam campos do CRM (code, type, value, active, etc.)
- Receita calculada corretamente (status !== cancelled, paymentStatus === paid)
- Minha Loja lê do storeConfig aninhado e salva com dot notation
- Build v1.8.0 (.deb) publicado no GitHub
---
Task ID: 1
Agent: Main Agent
Task: Implement offline/online status indicator and create v1.9.1 release

Work Log:
- Explored existing codebase: useOnlineStatus.ts, OfflineBanner.tsx, AppLayout.tsx already had the feature implemented
- Improved useOnlineStatus hook: replaced fixed 2-second timeout with Firebase's `waitForPendingWrites` for real sync detection
- Added fallback of 3 seconds if waitForPendingWrites fails
- Enabled Firestore offline persistence (`enableIndexedDbPersistence`) in lib/firebase.ts for true local data saving
- Added OfflineBanner to layout/index.ts barrel exports
- Bumped version from 1.9.0 to 1.9.1 in package.json
- Built Linux .deb and Windows .zip packages
- Pushed to GitHub, created tag v1.9.1, and released with both assets

Stage Summary:
- v1.9.1 released at https://github.com/Pedro21062014/nova-crm-desktop/releases/tag/v1.9.1
- Key improvements: real Firebase sync detection instead of timeout, Firestore offline persistence enabled
- Files: nova-crm_1.9.1_amd64.deb, Nova-CRM-1.9.1-win-x64.zip
---
Task ID: 1
Agent: Main Agent
Task: Integrate Minha Loja tab matching CRM repository structure

Work Log:
- Explored CRM repository (Pedro21062014/CRM) to find StoreEditor component structure
- Found StoreEditor in App.tsx with 4 tabs: Geral, Horários, Pagamento, Construtor
- Analyzed all tab features: address search, opening hours, payment config, visual builder with sections
- Completely rewrote SettingsPage.tsx to match CRM structure
- Added tabs: Geral (name, logo/banner, category, whatsapp, address search with Photon API + GPS, theme color), Horários (weekly schedule with open/close times), Pagamento (PIX key, CPF/CNPJ, native payment toggle), Construtor (section management with drag & drop, section editor, phone preview)
- Added publish/unpublish store toggle in header
- Added field validation (PIX key required for native payment, CPF/CNPJ required for publishing)
- Built Linux .deb and Windows .zip
- Created GitHub release v1.10.0

Stage Summary:
- v1.10.0 released at https://github.com/Pedro21062014/nova-crm-desktop/releases/tag/v1.10.0
- Complete rewrite of SettingsPage to match CRM's StoreEditor
- New features: 4-tab layout, opening hours, address search, visual store builder with preview
- Files: nova-crm_1.10.0_amd64.deb, Nova-CRM-1.10.0-win-x64.zip
---
Task ID: 1
Agent: Main Agent
Task: Remover o módulo WhatsApp do app e publicar v2.9.0 com workflow do GitHub Actions

Work Log:
- Removido electron/whatsapp.js (cliente whatsapp-web.js + sessão LocalAuth + QR code)
- Removidos os handlers IPC whatsapp:* de electron/main.js (init, status, chats, mensagens, envio, contatos, logout, destroy) e o require do módulo
- Removida a partição de sessão persist:whatsapp e a liberação de webviewTag (só existia para o embed do WhatsApp Web)
- Removida toda a API WhatsApp do electron/preload.js (whatsappInit/Send/GetChats/etc. + listeners onWhatsapp*)
- Removidos os tipos WhatsApp de src/types/electron.d.ts (WhatsAppChat/Message/Contact/Status/QR/Ack + bloco JSX webview)
- Removida a página src/components/whatsapp/WhatsAppPage.tsx, a rota /whatsapp em App.tsx e o item "WhatsApp" na Sidebar
- Removida a integração de mensagens agendadas (ScheduledMessage, COLLECTIONS.SCHEDULED_MESSAGES, useScheduledMessages) que só era usada pela página do WhatsApp
- Removidas as dependências whatsapp-web.js, qrcode, qrcode-terminal e @types/qrcode; package-lock.json regenerado
- Campo de telefone da loja mantido no Firestore (compatibilidade), mas o rótulo na UI passou a ser "Telefone de atendimento"
- Workflows .github/workflows/ci.yml e release.yml reescritos: Node 22 (electron 42 exige >=22.12), release sincroniza a versão do package.json com a tag e continua publicando .exe/.deb/.AppImage/.dmg + latest*.yml
- Build validado localmente: tsc -b + vite build OK
- Versão 2.8.10 -> 2.9.0, commit + tag v2.9.0 enviados para a main, release gerado pelo workflow

Stage Summary:
- v2.9.0: WhatsApp totalmente removido do app desktop (Electron + renderer + Firebase), app mais leve e sem dependência do whatsapp-web.js
- Release: https://github.com/Pedro21062014/nova-crm-desktop/releases/tag/v2.9.0
---
Task ID: 1
Agent: Main Agent
Task: Desligar o auto-update dentro do Flatpak e publicar v2.9.1

Work Log:
- electron/main.js: nova flag IS_FLATPAK (process.env.FLATPAK_ID) que desliga o electron-updater quando o app roda empacotado como Flatpak (check manual, check de inicializacao e check periodico)
- update:check passa a responder { status: "flatpak" } nesse caso
- useAutoUpdate.ts: novo status "flatpak" no UpdateStatus, tratado como "dev" (sem UI de atualizacao)
- UpdateBanner.tsx: nao exibe banner no Flatpak; SettingsPage mostra status "Via Flathub"
- src/types/electron.d.ts: checkForUpdates aceita status "flatpak"
- Build validado (tsc -b + vite build), versao 2.9.0 -> 2.9.1, release + pacote .flatpak publicados

Stage Summary:
- v2.9.1: no Flatpak as atualizacoes passam a ser responsabilidade da Flathub (o app nao tenta mais se auto-atualizar)
- Release: https://github.com/Pedro21062014/nova-crm-desktop/releases/tag/v2.9.1
---
Task ID: 1
Agent: Main Agent
Task: Portar abas de Automações, Propostas, Pipeline e Tarefas do CRM web para o app desktop e preparar release

Work Log:
- Explorou o repositório CRM (Pedro21062014/CRM) em modo somente-leitura para entender as 4 abas avançadas e como elas chamam o Firebase (coleções, campos, timestamps, seed de receitas)
- Mapeou as coleções Firestore compartilhadas:
  - merchants/{uid}/automations   (Automações & Regras, CRMAutomation)
  - merchants/{uid}/proposals     (Propostas & Orçamentos, CommercialProposal)
  - merchants/{uid}/opportunities (Pipeline de Vendas, Opportunity)
  - merchants/{uid}/tasks         (Tarefas & Agenda, CRMTask)
- Adicionou os tipos Opportunity/Proposal/Task/Automation e as chaves de coleção (PIPELINE, PROPOSALS, TASKS, AUTOMATIONS) em src/services/firebase.ts
- Criou hooks usePipeline/useProposals/useTasks/useAutomations em src/hooks/useFirebaseData.ts
- Criou src/lib/crmData.ts com helpers de compatibilidade (nome/telefone do cliente e produto nos dois formatos), sanitizeFirestoreData (mesma lógica do CRM) e utilitários de data/shell
- Criou src/hooks/useToast.tsx (sistema de toasts leve estilo sonner, sem dependência nova) + ToastProvider em src/App.tsx
- Implementou 4 páginas novas seguindo o padrão visual do desktop (tema shadcn, motion, Card/Button/Input/Modal):
  - src/components/pipeline/PipelinePage.tsx  (kanban 6 etapas, métricas, mover etapa com probabilidade, link produtos)
  - src/components/proposals/ProposalsPage.tsx (PDF via jsPDF, compartilhar WhatsApp, converter em pedido, itens do catálogo)
  - src/components/tasks/TasksPage.tsx        (hoje/atrasadas/próximas/concluídas, vínculo cliente+oportunidade, WhatsApp)
  - src/components/automations/AutomationsPage.tsx (seed das receitas padrão do CRM, toggle ativo, visualizador de fluxo)
- Rotas /pipeline, /propostas, /tarefas, /automacoes em src/App.tsx e itens no Sidebar.tsx (TrendingUp/FileText/CalendarCheck/Zap)
- Adicionou jspdf (^4.2.1) como dependência para geração de PDF das propostas
- Build validado (tsc -b + vite build OK); versão 2.9.1 -> 2.10.0

Stage Summary:
- 4 abas avançadas do CRM (Pipeline, Propostas, Tarefas, Automações) agora disponíveis no app desktop, lendo/escrevendo as mesmas coleções Firestore do CRM web
- v2.10.0 pronto para o workflow de release (Build & Release Desktop App)
- Release: https://github.com/Pedro21062014/nova-crm-desktop/releases/tag/v2.10.0
---
Task ID: 1
Agent: Main Agent
Task: Corrigir 404 no auto-update do AppImage (latest-linux.yml vs nome do asset)

Work Log:
- Diagnóstico: electron-builder gerava o AppImage com nome "Nova CRM-2.10.0.AppImage" (com ESPAÇO, do productName), mas o latest-linux.yml referenciava "Nova-CRM-2.10.0.AppImage" (traço) e o GitHub subiu o asset como "Nova.CRM-2.10.0.AppImage" (ponto)
- Consequencia: o electron-updater tentava baixar Nova-CRM-2.10.0.AppImage -> 404 ao verificar atualizacoes pelo app
- Correcao imediata (v2.10.0): renomeado o asset via API do GitHub para Nova-CRM-2.10.0.AppImage (mesmo nome do manifest); conteudo/sha512 inalterados
- Bloco do blockmap do AppImage nao e fatal no electron-updater 6.8.9: falta dele apenas desabilita o download diferencial (fallback para download completo)
- Correcao permanente: artifactName explicito "Nova-CRM-${version}.${ext}" no target AppImage do package.json (sem espaco, casa com o manifest em todos os proximos releases)
---
Task ID: 1
Agent: Main Agent
Task: Otimizar performance dos modais das abas novas (Pipeline, Propostas, Tarefas, Automações) e publicar v2.10.1

Work Log:
- Diagnóstico da travadinha ao abrir modais: ao abrir o modal, o componente inteiro da página re-renderizava — kanban inteiro (6 colunas + todos os cards), grade de propostas, lista de tarefas e grid de automações eram re-renderizados junto com o modal
- Causa adicional: useFirebaseList criava o array "items" novo a cada render (referência instável), invalidando todos os useMemos das páginas
- Correcao 1: "items" do useFirebaseList agora memoizado com useMemo([data]) — referencia estavel, so muda com snapshot novo do Firestore (beneficia todas as paginas do app)
- Correcao 2: listas/boards extraidos em componentes React.memo (PipelineBoard, ProposalsGrid, TasksList, AutomationsGrid) — abrir/fechar modal ou digitar no formulario nao re-renderiza mais a lista
- Correcao 3: todos os callbacks de acao (openEdit, handleDelete, handleMoveStage, handleToggleComplete, handleToggleActive, handleGeneratePDF, handleShareWhatsApp, handleConvertToOrder) estaveis com useCallback
- Correcao 4: jsPDF agora e import dinamico (await import("jspdf")) — só carrega ao gerar o PDF; chunk principal encolheu 2213 kB -> 1813 kB (gzip 672 -> 540 kB)
- Build validado (tsc -b + vite build OK), versao 2.10.0 -> 2.10.1

Stage Summary:
- v2.10.1: modais das abas novas abrem sem re-renderizar as listas (sem travadinha), bundle inicial ~19% menor
- Release: https://github.com/Pedro21062014/nova-crm-desktop/releases/tag/v2.10.1
---
Task ID: 1
Agent: Main Agent
Task: Exibir e enviar imagens/arquivos no Chat (paridade com o CRM web) e publicar v2.10.2

Work Log:
- Problema: no chat do desktop as imagens e documentos recebidos (enviados pelo CRM web) nao apareciam — a UI so renderizava msg.text e o sender nao gravava o campo "attachment" na mensagem
- Referencia: repo base CRM (so leitura) — components/CustomerChat.tsx, components/ChatAttachmentView.tsx, src/utils/chatAttachment.ts e convertFileToBase64 em src/utils/helpers.ts
- Nova lib src/lib/chatAttachment.ts (port do processChatFile do CRM):
  - imagens: comprimidas via canvas (max 1024x1024, quality 0.75, WebP > JPEG com fundo branco; PNG/WebP pequenos mantem transparencia)
  - documentos: limite de 5MB, lidos como data URL base64
  - formato ChatAttachment {name,type,size,data,isImage,compressedSize,originalSize} — idêntico ao que o CRM web grava
- services/firebase.ts: interface ChatMessage agora tem attachment?: ChatMessageAttachment; sendChatMessage grava o attachment no push do RTDB e o lastMessage da conversa vira "📷 Imagem" / "📄 nome" quando nao ha texto (mesma regra do CRM)
- hooks/useChat.ts: sendMessage(text, attachment?) repassa o anexo
- Componente novo src/components/chat/ChatAttachmentView.tsx (port de ChatAttachmentView.tsx do CRM, com tokens do desktop):
  - PendingAttachmentBar: preview do anexo acima da input (removivel, mostra tamanho comprimido)
  - ChatMessageAttachment: dentro da bolha — imagem vira thumbnail clicável (lightbox), documento vira card com download
  - ImageLightboxModal: zoom em tela cheia + baixar
- ChatPage.tsx: botao de clipe (aceita image/*, pdf, doc/docx, txt, csv, xlsx, zip) + input de arquivo oculto; da p/ enviar soh com anexo (sem texto); bolha renderiza o anexo acima do texto; lightbox integrado
- Compatibilidade: o que o CRM web enviar chega no desktop (onValue ja traz o attachment) e o que o desktop enviar chega no CRM web (mesmo formato/caminho no RTDB)
- Build validado (tsc -b + vite build OK); novos arquivos 100% limpos no eslint; bundle estavel (1820 kB, gzip 542 kB)
- Versao 2.10.1 -> 2.10.2

Stage Summary:
- v2.10.2: chat agora mostra imagens (com zoom) e arquivos recebidos, e permite anexar/enviar imagens (comprimidas) e documentos de ate 5MB — mesmo fluxo e formato do CRM web
- Release: https://github.com/Pedro21062014/nova-crm-desktop/releases/tag/v2.10.2
---
Task ID: 1
Agent: Main Agent
Task: Corrigir exibicao das "novidades da versao" (HTML/lista crua de commits) e publicar v2.10.3

Work Log:
- Problema: a caixa "Novidades da v2.10.x" em Configuracoes mostrava o body da release bruto — gerado pelo workflow com git log cru ("feat(chat): ... (5ee8ad8)") que o GitHub renderiza como HTML com links de commit (<ul>/<a class="commit-link">), alem do rodape "Built with GitHub Actions"
- Correcao 1 (exibicao): SettingsPage.tsx ganhou formatReleaseNotes() — remove tags HTML e entidades, descarta rodape de build/separadores/heading de versao, converte ### em subtitulo e - / * em topicos com marcador; negrito inicial do item vira rotulo destacado (renderNoteText); fallback "Veja os detalhes no GitHub." quando nao ha conteudo
- Correcao 2 (origem): novo CHANGELOG.md no repo raiz com as novidades por versao em pt-BR amigavel; o workflow de release agora extrai a secao da versao atual (awk entre os dois "## [") e usa como body da release; fallback (sem CHANGELOG) agora e git log SEM hash
- Correcao 3 (releases ja publicadas): body de v2.10.1 e v2.10.2 atualizado via API (PATCH release) com texto limpo — o app ja instalado passa a mostrar as novidades dessas versoes sem o HTML estranho
- Build validado (tsc -b + vite build OK), versao 2.10.2 -> 2.10.3

Stage Summary:
- v2.10.3: "Novidades da versao" exibida limpa e organizada (topicos + subtitles), release notes do GitHub geradas do CHANGELOG
- Release: https://github.com/Pedro21062014/nova-crm-desktop/releases/tag/v2.10.3
---
Task ID: 1
Agent: Main Agent
Task: Banner offline/sincronização no topo (amarelo sem internet + sincronizando com %) e publicar v2.10.4

Work Log:
- Pedido: no topo (na mesma posição do banner de atualização), quando a pessoa desativa a internet → banner AMARELO avisando que está sem internet, que as alterações serão salvas localmente e que ao reconectar será sincronizado automaticamente; ao reconectar → banner "sincronizando" com PERCENTAGEM de progresso
- Nova lib src/lib/syncTracker.ts: conta escritas "em voo" (enviadas, sem ack do servidor) — cada escrita (RTDB set/update/remove e Firestore setDoc/updateDoc/addDoc/deleteDoc) passa por trackWrite e decrementa no ack; expõe pendingWrites() e onPendingWritesChange()
- services/firebase.ts: todas as escritas do app agora passam pelos wrappers trackWrite (rtdbSet/rtdbUpdate/rtdbRemove/setDoc/updateDoc/addDoc/deleteDoc) — centralizadas, sem tocar nas páginas
- useStoreConfig.ts: a única escrita direta fora do service (setDoc de storeConfig) também passou por trackWrite
- hooks/useOnlineStatus.ts: máquina de estados online/offline/syncing + syncPercent REAL:
  - "online" → baseline = quantas escritas estavam na fila; percent = (1 - pendentes/baseline)*100 (99% máx até concluir)
  - conclusão = 0 pendentes no tracker E waitForPendingWrites (cobre o que não passa pelo tracker) E tempo mínimo de 1,2s (sem pisca-pisca)
  - timer de segurança de 60s caso algum ack não chegue; cair a conexão durante o sync volta p/ offline e recomeça do zero ao reconectar
  - testado por simulação com 3 cenários (acks antes do tempo mínimo, reconexão sem fila, queda durante o sync)
- OfflineBanner.tsx: offline = bg-warning (amarelo) 2 linhas ("Sem conexão com a internet" + "Suas alterações serão salvas localmente e sincronizadas automaticamente quando a conexão voltar"); syncing = "Sincronizando alterações salvas localmente..." + porcentagem à direita + barra de progresso animada; ao concluir mostra "Sincronização concluída" por ~1,2s
- Build validado (tsc -b + vite build OK), versao 2.10.3 -> 2.10.4

Stage Summary:
- v2.10.4: banner amarelo de offline com aviso de salvamento local + sincronização automática, e "sincronizando" com porcentagem real do progresso
- Release: https://github.com/Pedro21062014/nova-crm-desktop/releases/tag/v2.10.4
---
Task ID: 1
Agent: Main Agent
Task: Corrigir detecção de offline (banner não aparecia sem internet) e publicar v2.10.5

Work Log:
- Problema: o banner amarelo de offline não aparecia quando a internet caia — o hook dependia dos eventos online/offline do navegador, que no Electron/Linux NÃO disparam (bug conhecido do Electron: navigator.onLine sempre true no Linux)
- Correção: useOnlineStatus agora faz PING de conectividade no próprio backend do app a cada 10s + ping inicial no mount:
  - GET https://crm-e-vendas-default-rtdb.firebaseio.com/.json?shallow=-1 (timeout 5s)
  - QUALQUER resposta HTTP (inclusive 401, pois as rules bloqueiam leitura sem auth) = backend alcançável = online
  - erro de rede / timeout = offline
  - validado do sandbox: com internet → HTTP 401 (responde) = online; sem rede o fetch lançaria = offline
- Máquina de estados: ping falhou durante online/syncing → goOffline (pega conexão caindo no meio do sync); ping ok durante offline → goOnline (sincronização com %); evento "offline" do navegador segue como caminho rápido; evento "online" só reconecta se o ping confirmar
- Endpoint .info/connected testado e DESCARTADO (redireciona p/ login Google); .json 401 direto + CORS * = ideal
- Build validado (tsc -b + vite build OK), versao 2.10.4 -> 2.10.5

Stage Summary:
- v2.10.5: detecção de offline confiável via ping no backend (todas as plataformas) — o banner amarelo aparece de verdade
- Release: https://github.com/Pedro21062014/nova-crm-desktop/releases/tag/v2.10.5
---
Task ID: 1
Agent: Main Agent
Task: Trocar o ping de conectividade para endpoint Google (sem cota do Firebase) e publicar v2.10.6

Work Log:
- Contexto: IA do user recomendou usar HEAD + URL do Google p/ testar internet sem consumir cota do Firebase (o ping anterior batia no RTDB do projeto a cada 10s)
- Verificação: http://google.com (URL citada pela IA) NAO retorna 204 — dá 301 → 200 com 83KB de HTML; a URL real do teste de conectividade do Google é https://clients3.google.com/generate_204 (204, 0 bytes; HEAD também funciona)
- O endpoint NAO envia header CORS → fetch normal lançaria erro mesmo online (falso offline); solução: fetch HEAD + mode "no-cors" (resposta opaca: resolveu = tem internet, lançou = offline)
- useOnlineStatus: pingConnectivity() substitui o ping no RTDB; todo o resto da máquina de estados (2 falhas seguidas, sync com %, eventos do navegador) intacto
- Consequência: o app não faz NENHUMA requisição ao Firebase só para checar internet — cota 100% livre de overhead de ping
- Build validado (tsc -b + vite build OK), versao 2.10.5 -> 2.10.6

Stage Summary:
- v2.10.6: ping de conectividade via Google generate_204 (HEAD, zero bytes, zero cota Firebase)
- Release: https://github.com/Pedro21062014/nova-crm-desktop/releases/tag/v2.10.6
---
Task ID: 1
Agent: Main Agent
Task: Corrigir "salvar travado" offline (botão ficava carregando até cancelar) em todas as abas e publicar v2.10.7

Work Log:
- Problema: sem internet, o botão de Salvar ficava "travado" (loading) porque o await da escrita Firebase só resolve no ack do servidor — offline esse ack nunca chega; o user precisava clicar em Cancelar
- Correcao 1 (central, syncTracker.trackWrite): a UI agora aguarda a confirmacao do servidor por no maximo WRITE_ACK_TIMEOUT_MS (3s) via Promise.race:
  - online: ack em <1s → resolve normal (comerciante nao percebe diferenca)
  - offline: resolve como "salvo local" apos 3s — a escrita continua na fila (contador do tracker segue a Promise REAL) e sincroniza quando reconecta (banner "Sincronizando X%")
  - erro real (ex: permission-denied) continua propagando pro catch (toast de erro)
  - done.catch() evita unhandled rejection quando o erro chega apos o timeout
  - como TODAS as escritas passam pelos wrappers, o fix vale para TODAS as abas (clients, products, orders, pipeline, proposals, tasks, automations, chat, configs)
- Correcao 2 (IDs locais): create() e createChatConversation() trocaram addDoc por generateDocId() + setDoc — o ID ja existe na hora (mesmo offline); addDoc so devolveria o ID apos o ack (e quebraria no timeout, que resolve undefined)
- Teste por simulacao: 4 cenarios (ack 100ms / ack nunca / rejeicao real / contador segue ate ack real) — todos ok
- Nota: dados Firestore sobrevivem a restart (IndexedDB persistence ja ativa); mensagens de chat (RTDB) ficam em memoria offline — se fechar o app sem net, elas se perdem (limitacao do SDK RTDB v12, sem persistent cache)
- Build validado (tsc -b + vite build OK), versao 2.10.6 -> 2.10.7

Stage Summary:
- v2.10.7: salvar offline nao trava (salva local em ate 3s + sync automatico), IDs locais nas criacoes, todas as abas
- Release: https://github.com/Pedro21062014/nova-crm-desktop/releases/tag/v2.10.7
---
Task ID: 1
Agent: Main Agent
Task: Corrigir sincronização de produtos/clientes sem dados completos no CRM web e publicar v2.10.8

Work Log:
- Diagnóstico: o desktop gravava produtos em PT (nome, preco, categoria, descricao, imagem, estoque, ativo) e clientes em PT (nome, telefone, endereco...), mas o CRM web (repo base) LE SÓ o formato canônico EN:
  - produto: name, price, stock, category, description, imageUrl (+ hasWeightOptions/weightOptions/hasFlavorOptions/flavorOptions/hasAdditionalOptions/additionalOptions/orderIndex)
  - cliente: name, phone, email, clientType, address{street,number,neighborhood,city,zip,complement}
  - confirmacao direta no repo CRM: ProductsManager.tsx (ler/criar p.name/p.price/p.stock...) e ClientsManager.tsx (c.name/c.phone/c.email)
  - o desktop leria os dois (getters duais nome||name) por isso tudo parecia certo LA no desktop
- Verificado que os demais fluxos ja estao canonicos: pedidos (customerName/items/total/status), pipeline (title/clientName/value/probability/stage — igual ao SalesPipelineManager), cupons (code/type/value — "Save in CRM format"), propostas/tarefas/automacoes (portadas do CRM em v2.10.0)
- Caminho confirmado igual: getStorePath (CRM) e ensureMerchantPath (desktop) -> merchants/{uid}/{subcollection}
- Nova lib src/lib/dataFormat.ts: productToCrmFormat/productNeedsCrmSync + clientToCrmFormat/clientNeedsCrmSync (mapeia PT->EN; address string vira {street:...}; numero via parseFloat seguro)
- ProductsPage.handleSave: payload agora PT + EN (imagem so em imageUrl, sem duplicar base64; orderIndex = produtos.length)
- ClientsPage.handleSave: payload PT + EN (name/phone/email/address/clientType; campos commercial ja eram iguais: contactPerson, purchasePotential, nextVisit...)
- Migracao unica por aba (ref guard + max 50 por load, fire-and-forget com log): documentos so-PT ganham os campos EN via editItem (merge) ao carregar a aba — sem tocar em docs ja canonicos
- Teste por simulacao: 4 cenarios (produto PT/EN, cliente PT/EN) — normalizacao ok e idempotente
- Build validado (tsc -b + vite build OK), versao 2.10.7 -> 2.10.8

Stage Summary:
- v2.10.8: produtos e clientes sincronizam completos nos dois apps (escrita dual + migracao automatica do catalogo existente)
- Release: https://github.com/Pedro21062014/nova-crm-desktop/releases/tag/v2.10.8

## v2.11.0 — Paridade dos escopos de criação de produto com o CRM web

Task: explorar o repo base (CRM) e portar TODOS os escopos da criação de produto para o desktop; lançar v2.11.0
Work Log:
- Mapeamento no repo base (somente leitura): ProductsManager.tsx — form base (foto1, foto2 opcional por upload/URL, nome, preço, estoque, validade date, categoria, descricao) + seção "Opções de venda": hasWeightOptions/weightOptions[{weight,price,imageUrl}], hasFlavorOptions/flavorOptions[{name,price,imageUrl}], hasAdditionalOptions/additionalOptions[{name,price,imageUrl}], optionGroups[{id,name,isRequired,minQuantity,maxQuantity,options[{id,name,price,imageUrl}]}]; save handler grava imageUrl, images[], secondaryImageUrl, os 4 flags+arrays, expirationDate, orderIndex = max+1
- Checkout (StoreComponents.tsx L191-260): peso SUBSTITUI o preço; sabor/adicionais/opções de grupo SOMAM (0 = grátis); isRequired força min>=1; maxQuantity padrão 1; imageUrl da variação troca a imagem exibida
- src/services/firebase.ts: interface Product ganha campos canônicos EN (name/price/stock/category/description/imageUrl/images/secondaryImageUrl/expirationDate/orderIndex) + os 4 escopos de opção tipados
- src/lib/dataFormat.ts: productToCrmFormat agora passa os 4 escopos (com defaults p/ docs legados PT: flags false, arrays []) + images/secondaryImageUrl/expirationDate/orderIndex
- src/components/products/ProductsPage.tsx (reescrito): form completo com paridade — foto2 (upload + URL -> secondaryImageUrl), validade (date), preço desativado+zerado no modo peso, seção "Opções de venda" com os 4 escopos (SwitchRow), linhas de variação = foto (VariationImageBtn, 640px q0.82 via convertFileToBase64) + nome/peso + preço R$ + remover, grupos com isRequired toggle (min 0->1), min>=0/max>=1 e opção "+ R$" adicional, OptInput local (input raw p/ flex nas linhas), foto principal comprimida 1024px q0.82 antes de salvar, openEdit carrega todos os campos novos, handleSave payload completo dual (orderIndex = max+1 novo / preserva edit; arrays zerados quando flag off; images[0..1]), badges de opção nos cards (Scale/CakeSlice/PlusCircle/Layers)
- Build validado (tsc -b + vite build OK), versao 2.10.8 -> 2.11.0

Stage Summary:
- v2.11.0: criação de produto com paridade total dos escopos do CRM web (peso, sabor, adicionais, grupos, foto2, validade)

## v2.11.1 — Update do Electron para a versão mais recente

Task: atualizar Electron para a versão mais recente e lançar nova versão
Work Log:
- Versao atual: electron 42.0.1 (package.json ^42.0.1); npm view electron version -> 44.1.1 (latest)
- npm install electron@44.1.1 --save-dev -> package.json ^44.1.1 + lock atualizado
- electron-builder tambem desatualizado: 26.8.1 vs 26.15.3 (mesmo major 26, sem breaking change) — atualizado junto para garantir packaging correto do Electron 44 no CI
- Falha no primeiro run da v2.11.1 (job Windows): electron-builder 26.15.3 virou erro hard p/ win.icon inexistente (26.8.1 ignorava silenciosamente) — "cannot find specified resource build/icon.ico"
- Criei build/icon.png (512x512, copia do flatpak/icon.png) + build/icon.ico multi-size (256/128/64/48/32/24/16) via ImageMagick; package.json ja incluia build/**/* em files
- Build local validado (tsc -b + vite build OK com electron 44.1.1 na devDependency), versao 2.11.0 -> 2.11.1

Stage Summary:
- v2.11.1: motor Electron atualizado 42.0.1 -> 44.1.1 (+ electron-builder 26.15.3)

## v2.12.0 — Seletor de loja + Aba Equipe (paridade com CRM web)

Task: colocar seletor de loja e a aba equipe igual ao repo base
Work Log:
- Mapeamento no repo base (somente leitura): ActiveStoreContext.tsx (model: main=merchants/{uid}, sub=merchants/{uid}/stores/{id}, team=merchants/{ownerUid}; localStorage novaCrmActiveStoreId/novaCrmActiveTeamStore; getStorePath; hasPermission), ActiveStoreSwitcher.tsx (dropdown: minhas lojas + lojas da equipe via teamInvites por email com dedup por merchantId + nome/logo ao vivo do doc do merchant; auto-seleciona 1a loja de equipe se nada salvo), TeamManager.tsx (1652 linhas: ROLE_PRESETS 5+custom, PERMISSION_METADATA 14 mods em 3 categorias, writes team/{sanitized}+team/{email}+teamInvites/{key}+teamInvites/{emailKey}, edit/update/delete espelhados, convites recebidos com "Acessar Loja"), useTeamPresence.ts (RTDB team_presence/{merchantId}/{uid} heartbeat 15s + onDisconnect + dual-sync Firestore merchants/{merchantId}/teamPresence, fallback online se lastSeen < 45s), Dashboard.tsx routePermissionMap (chat -> clients, team sempre visivel)
- src/services/firebase.ts: store-aware — MAIN_STORE_ID, _activeStoreId/_activeTeamMerchantId, setActiveStore/getActiveStore/getStoreVersion/onStoreChange (pub-sub); ensureMerchantPath() agora retorna merchants/{owner} (equipe) ou merchants/{uid}/stores/{id} (sub) ou merchants/{uid} (main); exportado; todos os helpers (getAll/getById/create/update/remove/subscribe, merchant doc helpers, RTDB merchant + chats) usam o path store-aware
- src/lib/teamRoles.ts (novo): tipos TeamRole/TeamPermissions/TeamMember/TeamPresence/ActiveTeamStoreInfo + DEFAULT/ALL_PERMISSIONS + ROLE_PRESETS (5+custom) + PERMISSION_METADATA (14) + CATEGORY_LABELS + ROUTE_PERMISSION_MAP do desktop + sanitizeDocId
- src/hooks/useActiveStore.tsx (novo): ActiveStoreProvider — estado activeStoreId/activeTeamStore (localStorage, mesmas chaves do CRM), propaga setMerchantId+setActiveStore no auth change e em trocas; escuta revogacao (docs team/{uid}+team/{email} somem -> reset); hasPermission (dono=todo, colaborador=permissions)
- src/hooks/useTeamPresence.ts (novo): port do hook do CRM (RTDB + Firestore, compat cross-app)
- src/components/layout/StoreSwitcher.tsx (novo): dropdown no topo da sidebar (expanded + collapsed), secoes Minhas Lojas / Lojas da Equipe, links Minha Equipe + Gerenciar Loja, auto-select 1a loja de equipe
- src/components/team/TeamPage.tsx (novo, /equipe): header + banner de convites recebidos (Acessar Loja), metricas (total/online/pendentes), busca + filtros (todos/online/pendentes/admins), lista com owner no topo + presence + badges de status, modal convidar (email/nome/6 presets + toggles por modulo com Todas/Nenhuma por categoria), modal editar, modal remover; writes identicos ao CRM (team sanitized+email, teamInvites key+emailKey; edit/delete espelhados)
- src/hooks/useFirebaseData.ts: useSyncExternalStore(onStoreChange, getStoreVersion) no deps do effect -> re-assina ao trocar de loja
- src/hooks/useStoreConfig.ts: assina doc da loja ativa (ensureMerchantPath) + re-assina p/ storeVersion; saveConfig grava no doc da loja ativa
- src/components/layout/Sidebar.tsx: item Equipe (Users2) antes de Configuracoes; StoreSwitcher abaixo do logo; filtro visibleNavItems por ROUTE_PERMISSION_MAP quando isTeamStore; redirect p/ dashboard se rota atual perder permissao
- src/App.tsx: ActiveStoreProvider dentro de AuthProvider + rota /equipe
- Obs: node_modules foi corrompido por um npx tsc (pacote fake) durante o dev — reinstalei via npm install; lock apenas sincronizado p/ 2.11.1
- Build validado (tsc -b + vite build OK), versao 2.11.1 -> 2.12.0

Stage Summary:
- v2.12.0: seletor de loja (multi-loja + lojas de equipe) e aba Equipe completa (convites, permissoes por modulo, presenca realtime, convites recebidos)

## v2.12.1 — Correção do fundo transparente no seletor de loja

Task: corrigir seletor de lojas transparente
Work Log:
- Diagnostico: o StoreSwitcher usava bg-popover/text-popover-foreground no dropdown (expanded e collapsed) — o token --color-popover NAO existe no index.css (tema do app so tem background/card/muted/accent/sidebar...) -> fundo transparente
- Corrigi p/ bg-card text-card-foreground (mesmo token que o Modal usa; --color-card = #ffffff)
- Obs: node_modules nao persiste entre sessoes (excluido do snapshot) — npm install de novo; build validado (tsc -b + vite build OK), versao 2.12.0 -> 2.12.1

Stage Summary:
- v2.12.1: dropdown do seletor de loja com fundo solid (bg-card)
