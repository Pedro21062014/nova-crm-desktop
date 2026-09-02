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
