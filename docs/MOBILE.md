# Android: assinatura e atualizações

O Android só instala uma versão nova **por cima** da anterior se as duas forem assinadas com a
**mesma chave** — vale para qualquer APK, mesmo fora da Google Play.

## Chave permanente do GCP-Calc

- A chave fica em `packaging/android/release.keystore.enc`, **criptografada** (AES-256, PBKDF2).
  Sem a senha, o arquivo não serve para nada — por isso pode ficar no repositório público.
- A senha fica só nos segredos do GitHub, com o nome **`ANDROID_KEY_PASSPHRASE`**
  (repositório › Settings › Secrets and variables › Actions › New repository secret).
- Na compilação da release, o GitHub Actions abre a chave com essa senha, assina o APK e apaga a
  chave aberta. Impressão digital (SHA-256) do certificado:
  `40:D4:47:6F:51:E8:59:CD:23:C0:D9:76:20:4D:18:DC:32:8D:7A:3F:78:E5:72:49:29:CF:D3:25:1C:AD:2F:96`

Guarde a senha também fora do GitHub (gerenciador de senhas). Se ela se perder, será preciso uma
chave nova — e todos teriam de reinstalar o app uma vez.

## Sem o segredo

Se `ANDROID_KEY_PASSPHRASE` não existir, a release usa uma chave temporária (o app funciona, mas
cada versão exige desinstalar e instalar de novo).
