---
Task ID: 1
Agent: Main Agent
Task: Nova CRM v1.5.0 - Fix bugs and add WhatsApp Web webview

Work Log:
- Cloned project from GitHub (v1.4.0)
- Read all source files to understand current codebase
- Fixed electron/main.js: added webviewTag: true for WhatsApp Web integration, added WhatsApp partition persistence, set User-Agent
- Fixed firebase.ts: improved error handling in updateItem/removeItem with specific error messages for permission-denied and not-found, added auth.currentUser fallback in merchantPath(), fixed toMs() to handle plain Timestamp-like objects, changed updateMerchantData to use setDoc with merge for reliable config saving, changed createWithId to merge instead of overwrite
- Fixed useFirebaseData.ts: added merchant ID verification before subscriptions, added isNew flag detection (orders within 1 hour), improved error handling with re-throw for CRUD operations, added clearError function
- Fixed useStoreConfig.ts: added pre-loading of existing config data via getMerchantData before subscription, added merchant ID verification, improved error handling
- Fixed OrdersPage.tsx: added visible error banners for failed operations, added new order badge (sparkles icon + "Novo" label), added blue accent strip for new orders, fixed status change and delete error handling with user-visible feedback
- Fixed ClientsPage.tsx: used useMemo for selectedClient and filtered list to prevent re-renders/freezes, used useCallback for handlers, changed AnimatePresence transition to spring physics for smoother animations, added error banners
- Fixed Modal.tsx: replaced tween animation with spring physics (stiffness: 400, damping: 30, mass: 0.8), adjusted overlay blur, faster exit animation
- Rewrote WhatsAppPage.tsx: added tab switcher between WhatsApp Web and Mensagens Programadas, embedded WhatsApp Web in Electron webview with persistent session (partition="persist:whatsapp"), added fullscreen toggle, reload button, messages can be sent directly to the webview
- Added src/types/electron.d.ts for webview JSX type declarations
- Fixed SettingsPage.tsx: merged existing form values with loaded config to prevent overwriting, added saved confirmation indicator, added error banners
- Built Linux .deb and Windows .zip packages
- Published v1.5.0 to GitHub with release notes

Stage Summary:
- Version: 1.5.0
- GitHub Release: https://github.com/Pedro21062014/nova-crm-desktop/releases/tag/v1.5.0
- Linux: nova-crm_1.5.0_amd64.deb (107MB)
- Windows: Nova-CRM-1.5.0-win-x64.zip (171MB)

---
Task ID: 2
Agent: Main Agent
Task: Fix chat not showing correct names - v1.7.1

Work Log:
- Explored the CRM web app repo (https://github.com/Pedro21062014/CRM) to understand its chat data structure
- Discovered the CRM uses a HYBRID approach: chat conversation metadata in Firestore + messages in RTDB
- CRM stores conversations at `merchants/{uid}/chats` as a Firestore subcollection with fields: `customerName`, `customerId`, `lastMessage`, `lastMessageSender`, `updatedAt`
- CRM stores messages at `merchants/{uid}/chats/{chatId}/messages` in RTDB with fields: `text`, `sender` ('merchant'|'customer'), `createdAt` (serverTimestamp)
- The old nova-crm-electron code was reading conversations from RTDB only, which is why no chats appeared
- Updated `firebase.ts`:
  - Changed ChatMessage interface to support both CRM format (`sender`, `createdAt`) and nova-crm format (`senderRole`, `senderId`, `senderName`, `timestamp`)
  - Changed ChatConversation interface to support both CRM fields (`customerId`, `lastMessageSender`, `updatedAt`) and nova-crm fields (`customerPhone`, `lastMessageTime`)
  - Added `subscribeChatsFirestore()` - subscribes to Firestore chats subcollection (primary source)
  - Kept `subscribeChatsRTDB()` as fallback
  - Updated `sendChatMessage()` to write CRM-compatible messages (`sender`, `createdAt`) and update Firestore conversation metadata
  - Updated `createChatConversation()` to create in Firestore first (primary), RTDB fallback
  - Added `deleteChatConversation()` for both Firestore and RTDB cleanup
  - Added `rtdbServerTimestamp` import and `orderBy` import
- Updated `useChat.ts`:
  - `useChats()` now subscribes to Firestore first, falls back to RTDB after 3s timeout
  - Added `deleteChat` function
  - Simplified `sendMessage` - no longer needs senderName parameter
  - Added `getMsgTime()` helper to extract timestamp from both CRM and nova-crm message formats
  - Added `isMerchantMessage()` helper to detect sender role from both formats
- Updated `ChatPage.tsx`:
  - Uses `getConvName()` to get customer name from conversation
  - Uses `getConvTime()` to get last message time from either `updatedAt` or `lastMessageTime`
  - Uses `isMerchantMessage()` for correct merchant/customer message detection
  - Shows "Você" for merchant messages, customer name for customer messages
  - Added delete conversation button with confirmation
  - Uses `formatMsgTime()` that handles both timestamp formats
  - Removed hardcoded "Loja" sender name
- Updated version to 1.7.1
- Build successful

Stage Summary:
- Version: 1.7.1
- Fixed: Chat now reads conversations from Firestore (where CRM stores them) with RTDB fallback
- Fixed: Correct customer names displayed from `customerName` field
- Fixed: Messages show "Você" for merchant and customer name for customer
- Fixed: Compatible with both CRM message format and nova-crm format
- Added: Delete conversation functionality
