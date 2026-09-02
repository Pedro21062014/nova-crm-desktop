# Changelog — Nova CRM Desktop

Todas as mudanças relevantes do aplicativo, em linguagem amigável.
Este arquivo é a fonte das "novidades da versão" exibidas no app (Configurações)
e nas release notes do GitHub. A seção da versão atual é usada como body da release.

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
