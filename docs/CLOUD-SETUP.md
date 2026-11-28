# Google Drive no GCP-Calc — guia completo

O GCP-Calc guarda backups e o arquivo de sincronização numa **pasta oculta e exclusiva do aplicativo** no seu Google Drive (escopo `drive.appdata`). O app **não enxerga nem altera** seus outros arquivos, e essa pasta não aparece na sua lista do Drive. Tudo é **cifrado com AES-256-GCM** antes de sair do aparelho, com uma chave derivada (PBKDF2-SHA256) da frase-senha que você escolhe.

> **Atalho:** se a sua versão já vem com um cliente OAuth (aparece “Pronto para conectar” em *Configurações → Backup e sincronização*), pule direto para [Conectar](#8-conecte-e-defina-a-frase-senha). O passo a passo abaixo é para criar o **seu próprio** cliente — leva uns 10 minutos e é feito **uma única vez**; o mesmo arquivo serve para todos os seus aparelhos.

O mesmo guia está dentro do app: **Configurações → Backup e sincronização → Guia passo a passo**.

---

## 1. Crie um projeto no Google Cloud

1. Abra <https://console.cloud.google.com/projectcreate> e entre com a sua conta Google.
2. Nome do projeto: **GCP-Calc** → **Criar**.
3. No topo da página, confira se o projeto **GCP-Calc** está selecionado.

## 2. Ative a Google Drive API

1. Abra <https://console.cloud.google.com/apis/library/drive.googleapis.com>.
2. Clique em **Ativar**.

## 3. Configure a tela de consentimento

1. Abra <https://console.cloud.google.com/auth/overview> e clique em **Começar** (em versões antigas do Console: *APIs e serviços → Tela de consentimento OAuth*).
2. **Nome do app:** GCP-Calc · **E-mail de suporte:** o seu.
3. **Público:** Externo.
4. **Informações de contato:** o seu e-mail → aceite os termos → **Criar**.

## 4. Adicione a permissão da pasta do app

1. Abra <https://console.cloud.google.com/auth/scopes> (*Acesso a dados*).
2. **Adicionar ou remover escopos** → procure por `drive.appdata`.
3. Marque **`.../auth/drive.appdata`** → **Atualizar** → **Salvar**.

## 5. Libere o seu acesso

Abra <https://console.cloud.google.com/auth/audience> (*Público*) e escolha:

- **Publicar app** *(recomendado)* — assim o login não expira. Ao entrar, o Google pode mostrar **“O Google não verificou este app”**: toque em **Avançado → Acessar GCP-Calc (não seguro)**. É o seu próprio app, criado por você.
- ou deixar **Em teste** e adicionar o seu e-mail em **Usuários de teste** (até 100). Nesse modo o Google **expira o login a cada 7 dias** e será preciso conectar de novo.

## 6. Crie a credencial e baixe o JSON

1. Abra <https://console.cloud.google.com/auth/clients> (*Clientes*) → **Criar cliente**.
2. **Tipo de aplicativo: App para computador** (*Desktop app*).
   > ⚠️ Tem que ser **App para computador**. O tipo *Aplicativo da Web* não funciona (dá `redirect_uri_mismatch`).
3. Nome: GCP-Calc → **Criar** → **Baixar JSON** (arquivo `client_secret_….json`).

## 7. Importe o JSON no GCP-Calc

1. **Configurações → Backup e sincronização → Importar JSON do Google** e escolha o arquivo baixado.
2. **No celular:** mande o arquivo para você mesmo (e-mail, Drive, WhatsApp), salve e importe do mesmo jeito.
3. Se preferir, use **Digitar manualmente** e cole o *Client ID* e o *Client secret* (estão dentro do JSON, em `installed.client_id` e `installed.client_secret`).

## 8. Conecte e defina a frase-senha

1. Toque em **Conectar**, entre com a sua conta Google e **permita** o acesso.
   - No celular, se o navegador não voltar sozinho para o app, volte ao GCP-Calc: o login termina em segundos.
2. Defina a **frase-senha da criptografia** (mínimo 8 caracteres).
   - Use **a mesma em todos os aparelhos**.
   - Ela **nunca sai do aparelho** e **não pode ser recuperada** — guarde num lugar seguro.
3. Pronto: a **sincronização automática** mantém os aparelhos espelhados e o **backup automático** guarda cópias datadas (diárias ou semanais, mantendo as últimas N).

## 9. Nos outros aparelhos

Importe **o mesmo JSON**, conecte com **a mesma conta Google** e use **a mesma frase-senha**.

---

## Se algo der errado

| Mensagem ou sintoma | Solução |
|---|---|
| **“Acesso bloqueado”** / `Error 403: access_denied` | Publique o app (passo 5) ou adicione o seu e-mail em *Usuários de teste*. |
| `redirect_uri_mismatch` ou `invalid_request` | O cliente foi criado como *Aplicativo da Web*. Crie outro do tipo **App para computador** e importe o novo JSON. |
| “Google Drive API has not been used in project…” | Ative a Google Drive API (passo 2) e aguarde 2–5 minutos. |
| Pede para conectar de novo toda semana | O app está *Em teste*. Em *Público*, clique em **Publicar app**. |
| “Este arquivo não é o JSON de cliente OAuth” | Baixe o JSON na lista de **Clientes** (ícone de download), não o de “conta de serviço”. |
| Outro aparelho não abre os dados | A frase-senha precisa ser exatamente a mesma em todos os aparelhos. |
| O navegador não volta ao app no celular | Volte ao GCP-Calc manualmente; o login conclui sozinho. |

## Segurança e privacidade

- O app pede **só** o escopo `drive.appdata` (pasta oculta do próprio app).
- O JSON do cliente e a frase-senha ficam **somente no aparelho**.
- Os dados vão para o Drive **já cifrados** (AES-256-GCM, chave PBKDF2-SHA256); nem o Google consegue lê-los.
- O login usa **PKCE** com redirecionamento para `http://127.0.0.1:<porta>` (servidor local temporário do próprio app), o fluxo recomendado pelo Google para aplicativos instalados.

---

## Para quem publica o app (GitHub Actions)

Para o build já vir com um cliente OAuth pronto (“Pronto para conectar”), crie em **Settings → Secrets and variables → Actions** do repositório:

| Segredo | Uso |
|---|---|
| `GOOGLE_CLIENT_ID` | ID do cliente OAuth (App para computador) |
| `GOOGLE_CLIENT_SECRET` | Segredo do cliente |
| `ANDROID_KEY_PASSPHRASE` | Frase que decifra a chave de assinatura permanente do Android (`packaging/android/release.keystore.enc`) |
