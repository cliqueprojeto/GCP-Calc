# Google Drive no GCP-Calc

O GCP-Calc guarda backups e o arquivo de sincronização na **pasta oculta do aplicativo** no Google Drive (escopo `drive.appdata`): o app não enxerga seus outros arquivos e eles não aparecem na sua lista do Drive. Tudo é cifrado com AES-256-GCM antes de sair do aparelho, com uma chave derivada (PBKDF2-SHA256) da frase-senha que você escolhe.

## Usando

1. **Configurações → Backup e sincronização → Conectar** (Google Drive).
2. Defina a **frase-senha da criptografia** (mínimo 8 caracteres). Use a mesma em todos os aparelhos — ela não sai do aparelho e não pode ser recuperada.
3. Pronto: a sincronização automática mantém os aparelhos espelhados e o backup automático guarda cópias datadas.

## Cliente OAuth próprio (opcional)

O build oficial já inclui um cliente OAuth (segredos `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` do repositório). Para usar o seu:

1. Em <https://console.cloud.google.com/> crie um projeto.
2. **APIs e serviços → Biblioteca →** ative a **Google Drive API**.
3. **Tela de consentimento OAuth:** tipo *Externo*; adicione o escopo `.../auth/drive.appdata`; publique o app (ou adicione seu e-mail como testador).
4. **Credenciais → Criar credenciais → ID do cliente OAuth →** tipo **App para computador**.
5. Copie o *Client ID* e o *Client secret* para **Configurações → Backup e sincronização → Configuração avançada**.

O login usa PKCE com redirecionamento para `http://127.0.0.1:<porta>` (servidor local temporário do próprio app), que é o fluxo recomendado pelo Google para aplicativos instalados.

## Para o build no GitHub Actions

Em **Settings → Secrets and variables → Actions** do repositório, crie:

| Segredo | Uso |
|---|---|
| `GOOGLE_CLIENT_ID` | ID do cliente OAuth (App para computador) |
| `GOOGLE_CLIENT_SECRET` | Segredo do cliente |
| `ANDROID_KEYSTORE_BASE64` | Keystore do Android em base64 (`base64 -w0 release.jks`) |
| `ANDROID_KEYSTORE_PASSWORD` | Senha do keystore |
| `ANDROID_KEY_ALIAS` | Alias da chave |
| `ANDROID_KEY_PASSWORD` | Senha da chave |

Sem a keystore, o APK é assinado com uma chave temporária (para atualizar será preciso desinstalar antes).
