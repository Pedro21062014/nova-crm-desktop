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
