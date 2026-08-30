# Nova CRM no Flatpak

Esta pasta tem tudo para empacotar o Nova CRM como Flatpak e publicá-lo na Flathub.

Arquivos:

| Arquivo | Para que serve |
| --- | --- |
| `br.com.novacrm.NovaCRM.yml.in` | Modelo do manifesto (versão e sha256 são preenchidos automaticamente) |
| `br.com.novacrm.NovaCRM.desktop` | Atalho do aplicativo (o nome precisa ser igual ao App ID) |
| `br.com.novacrm.NovaCRM.metainfo.xml` | Metadados AppStream (obrigatório para aparecer na Flathub) |
| `icon.png` | Ícone 512x512 |
| `build.sh` | Script que baixa o tar.gz do release, gera o manifesto e constrói/instala |
| `../.github/workflows/flatpak.yml` | Workflow que gera o `.flatpak` no CI e anexa ao release |

## Como funciona

Em vez de compilar o app dentro do sandbox do Flatpak (que não tem internet para baixar
Electron e os pacotes npm), nós **reempacotamos o `tar.gz` oficial** que o electron-builder
já gera. Por isso o `package.json` agora tem o target `tar.gz` no Linux, e o release publica
`nova-crm-<versao>.tar.gz`.

O manifesto usa:

- `org.freedesktop.Platform` / `org.freedesktop.Sdk` 25.08
- `org.electronjs.Electron2.BaseApp` 25.08 (fornece o Electron, o zypak e o `patch-desktop-filename`)
- `run.sh` + `zypak-wrapper.sh` para iniciar o app

---

## 1. Testar localmente

```bash
# dependências (Debian/Ubuntu/Fedora → equivalente)
sudo apt install flatpak flatpak-builder
flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo

# construir e instalar
cd flatpak
./build.sh 2.9.0

# rodar
flatpak run br.com.novacrm.NovaCRM

# gerar um arquivo .flatpak para distribuir
./build.sh 2.9.0 --bundle
```

## 2. Distribuir direto para seus usuários (sem Flathub)

```bash
flatpak install --user Nova-CRM-2.9.0.flatpak
```

Ou hospede seu próprio repositório (o `flatpak-builder` já cria o `repo/`):

```bash
flatpak build-bundle repo Nova-CRM.flatpak br.com.novacrm.NovaCRM stable
```

## 3. Publicar na Flathub (o "store" de Flatpak)

### 3.1 Requisitos que você precisa resolver antes

1. **App ID** — usamos `br.com.novacrm.NovaCRM` (DNS reverso de `novacrm.com.br`).
   Ele é definitivo: mudar depois exige reenviar o app. Alternativa, se não quiser
   verificar o domínio: `io.github.Pedro21062014.NovaCRM`.
2. **Verificação do domínio** — a Flathub pede um token em
   `https://novacrm.com.br/.well-known/org.flathub.VerifiedApps.txt`
   (ou verificação manual pelo GitHub, se usar ID `io.github.*`).
3. **Licença** — o repo ainda não tem arquivo de licença. Declare a licença no
   `project_license` do metainfo (hoje está `LicenseRef-proprietary` apontando para
   `https://novacrm.com.br/termos`). A Flathub exige que o app possa ser redistribuído.
4. **Metainfo completo** — nome, resumo, descrição, desenvolvedor, `content_rating`
   e pelo menos uma captura de tela (`flatpak/screenshots/`).

### 3.2 Enviar o pedido

1. Faça um fork de <https://github.com/flathub/flathub>
2. `git clone --branch=new-pr git@github.com:SEU_USUARIO/flathub.git`
3. `git checkout -b nova-crm`
4. Copie para a raiz do fork:
   - `br.com.novacrm.NovaCRM.yml` (o **gerado**, com sha256 — rode `./build.sh` antes)
   - `br.com.novacrm.NovaCRM.metainfo.xml`
   - `br.com.novacrm.NovaCRM.desktop`
   - `icon.png` (ou um SVG/PNG em `icons/`)
5. Commit, push e abra um **PR contra a branch `new-pr`**.
6. A revisão é feita por voluntários (pode levar dias/semanas). Eles vão pedir ajustes
   de permissões, metadados e licença.
7. Depois de aprovado, a Flathub cria o repositório `flathub/br.com.novacrm.NovaCRM`
   com acesso de escrita para você: cada commit lá gera um build automático e publica
   a atualização para todos os usuários.

### 3.3 Atualizações

Dentro do Flatpak, **o electron-updater não funciona** (o app está em filesystem
somente-leitura). O recomendado é desativar o auto-update quando o app roda dentro do
Flatpak, detectando a variável `FLATPAK_ID` no `electron/main.js`, e deixar as
atualizações por conta da Flathub.

Para nova versão:

1. Suba a versão no `package.json` e crie o release normal (gera o `.tar.gz`);
2. No repo `flathub/br.com.novacrm.NovaCRM`, atualize a URL e o `sha256` do manifesto
   (e a data/versão no metainfo). Existe um bot que abre PRs automáticos de atualização;
3. Merge → build automático → usuários recebem a atualização.

---

## Links úteis

- Guia de Electron do Flatpak: <https://docs.flatpak.org/en/latest/electron.html>
- Requisitos da Flathub: <https://docs.flathub.org/docs/for-app-authors/requirements>
- Metainfo (AppStream): <https://docs.flathub.org/docs/for-app-authors/metainfo-guidelines>
- Submissão: <https://docs.flathub.org/docs/for-app-authors/submission>

## Manifesto pronto para submissão

O arquivo `br.com.novacrm.NovaCRM.yml` (já com versão e sha256 preenchidos para a 2.9.1)
é exatamente o que deve ser copiado para a raiz do seu fork do `flathub/flathub`, junto de
`br.com.novacrm.NovaCRM.desktop`, `br.com.novacrm.NovaCRM.metainfo.xml` e `icon.png`.

Para uma versão nova, regenere com:

```bash
cd flatpak
VERSION=2.9.2
curl -fsSL -o /tmp/nova-crm-$VERSION.tar.gz \
  https://github.com/Pedro21062014/nova-crm-desktop/releases/download/v$VERSION/nova-crm-$VERSION.tar.gz
sed -e "s/@VERSION@/$VERSION/g" \
    -e "s/@SHA256@/$(sha256sum /tmp/nova-crm-$VERSION.tar.gz | cut -d' ' -f1)/g" \
    br.com.novacrm.NovaCRM.yml.in > br.com.novacrm.NovaCRM.yml
```
