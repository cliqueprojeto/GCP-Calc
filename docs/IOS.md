# GCP-Calc no iPhone, iPad e Mac

A Apple só permite instalar apps fora da App Store por caminhos específicos. Abaixo estão **as três formas**, da mais simples para a mais completa.

| | Como | Custo | Atualiza | Recursos |
|---|---|---|---|---|
| **1. App web (recomendado)** | Safari → *Adicionar à Tela de Início* | Grátis | Sozinho | Quase todos (veja a lista) |
| **2. App nativo (.ipa)** | Sideloadly ou AltStore com o seu Apple ID | Grátis | Reinstalar a cada 7 dias | Todos |
| **3. TestFlight / App Store** | Link de convite / loja | Conta Apple Developer (US$ 99/ano) | Sozinho | Todos |

---

## 1. App web — o jeito mais fácil (iPhone e iPad)

Nada para baixar, nenhuma permissão especial, nenhuma conta da Apple.

1. Abra no **Safari**: **<https://cliqueprojeto.github.io/GCP-Calc/>**
2. Toque em **Compartilhar** (quadrado com a seta para cima).
3. Role e toque em **Adicionar à Tela de Início** → **Adicionar**.
4. Abra pelo ícone **GCP-Calc** na tela inicial: ele abre em tela cheia, como um app.

Depois da primeira abertura, **funciona sem internet**. Os motores grandes (Python, SQL e a transcrição offline) são baixados na primeira vez que você os usa e ficam guardados.

**Funciona no app web:** notas e cálculos, seções, moedas (com internet), unidades, datas, previsto × realizado, BI, importar planilhas/PDF, gráficos, modelos, temas, exportar PDF/Word/PowerPoint/Excel, playground de código, voz (microfone), comprovantes (câmera/fotos), lembretes e backup em arquivo `.gcpcalc`.

**Diferenças em relação ao app instalado:**
- **Sincronização com o Google Drive** fica só no app instalado (computador, Android e o .ipa). No app web, use **Configurações → Backup em arquivo → Exportar backup / Importar** para levar os dados entre aparelhos.
- **Avisos de lembretes** aparecem com o app aberto (o iOS não agenda notificações de apps web).
- As notas ficam guardadas no próprio app da tela inicial. **Se apagar o ícone, os dados vão junto** — exporte um backup antes.

> Dica: no iPad, o app web também funciona em Split View e com teclado físico.

---

## 2. App nativo (.ipa) — sem App Store

Cada versão traz o arquivo **`GCP-Calc-x.y.z-iOS.ipa`** na [página de releases](https://github.com/cliqueprojeto/GCP-Calc/releases/latest). Ele vem **sem assinatura**: quem assina é o programa de instalação, com o seu Apple ID gratuito.

### Com o Sideloadly (Windows ou Mac)

1. Instale o **Sideloadly** (<https://sideloadly.io>) e, no Windows, o **iTunes** e o **iCloud** da Apple (versões do site da Apple, não da Microsoft Store).
2. Conecte o iPhone/iPad no cabo e toque em **Confiar** no aparelho.
3. Arraste o `GCP-Calc-…-iOS.ipa` para o Sideloadly, informe o seu **Apple ID** e clique em **Start**.
4. No aparelho:
   - **Ajustes → Geral → VPN e Gerenciamento de Dispositivo →** toque no seu e-mail → **Confiar**.
   - **iOS 16 ou mais novo:** **Ajustes → Privacidade e Segurança → Modo de Desenvolvedor → Ativar** (o aparelho reinicia).
5. Abra o GCP-Calc.

### Com o AltStore (Windows ou Mac)

1. Instale o **AltServer** (<https://altstore.io>) no computador e, por ele, o **AltStore** no aparelho.
2. No iPhone, abra o AltStore → **My Apps → +** → escolha o `.ipa` (salvo em Arquivos).
3. Faça os mesmos ajustes do passo 4 acima.

**Limites da Apple para Apple ID gratuito:** o app precisa ser **reassinado a cada 7 dias** (o AltStore faz isso sozinho quando o computador está na mesma rede Wi-Fi) e no máximo **3 apps** instalados assim ao mesmo tempo.

---

## 3. TestFlight ou App Store

É o único caminho com instalação por um toque e atualização automática sem computador, e **exige a conta Apple Developer** (US$ 99/ano) do responsável pelo projeto. Com a conta, o mesmo workflow que gera o `.ipa` (`.github/workflows/ios.yml`) pode assinar e enviar ao TestFlight; aí basta compartilhar o link de convite.

---

## Mac (macOS)

1. Baixe o `.dmg` do seu Mac na [página de releases](https://github.com/cliqueprojeto/GCP-Calc/releases/latest):
   - **Apple Silicon (M1, M2, M3, M4…):** `GCP-Calc-x.y.z-macOS-arm64.dmg`
   - **Intel:** `GCP-Calc-x.y.z-macOS-x86_64.dmg`

   Na dúvida:  → **Sobre Este Mac** → “Chip Apple” = Apple Silicon; “Processador Intel” = Intel.
2. Abra o `.dmg` e arraste o **GCP-Calc** para **Aplicativos**.
3. **Primeira abertura** (o app ainda não tem a assinatura paga da Apple):
   - Abra o GCP-Calc; quando aparecer o aviso, clique em **OK**.
   - Vá em ** → Ajustes do Sistema → Privacidade e Segurança**, role até **“GCP-Calc foi bloqueado…”** e clique em **Abrir Mesmo Assim** → digite a senha do Mac.
   - **Ou, de uma vez só**, cole no **Terminal** (Aplicativos → Utilitários):
     ```bash
     xattr -dr com.apple.quarantine /Applications/GCP-Calc.app
     ```
4. Pronto: das próximas vezes ele abre direto, e as atualizações chegam pelo próprio app.

Se aparecer **“está danificado e não pode ser aberto”**, é o mesmo bloqueio: use o comando do Terminal acima.
