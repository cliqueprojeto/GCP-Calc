# Colaboração em tempo real no GCP-Calc

Compartilhe uma **nota** ou uma **pasta inteira** com outras pessoas e editem juntos, ao vivo — sem criar conta e sem configurar Supabase, Firebase ou Google Cloud.

## Como usar

1. Abra a nota → menu **⋯** → **Compartilhar ao vivo**.
2. Escolha **o que** compartilhar: *esta nota* ou *a pasta inteira* em que ela está.
3. Escolha **como** sincronizar (veja abaixo) e o **seu nome** (aparece para os outros).
4. Toque em **Criar link** e envie (WhatsApp, e-mail…).
5. Quem recebe abre o link (no navegador ou colando em **⋯ → Entrar com link** no app instalado) e toca em **Entrar**.

O selo **Ao vivo** no topo da nota mostra quem está editando junto. Para parar: **⋯ → Compartilhar ao vivo → Parar de compartilhar**, ou em *Configurações → Colaboração*.

## As duas formas de sincronizar

| | Direto entre aparelhos (P2P) | P2P + servidor de sincronização |
|---|---|---|
| Configuração | **Nenhuma** | Um servidor seu, uma única vez (grátis) |
| Ao vivo com todos online | Sim | Sim |
| Suas alterações ficam salvas | Sim, no seu aparelho | Sim, no aparelho e no servidor (cifradas) |
| O outro recebe se você já fechou o app | Só quando estiverem online ao mesmo tempo | **Sim** |

**Em ambas**, cada aparelho guarda sua cópia completa: dá para editar sem internet, e as edições de todos se mesclam sem conflito quando voltam a se conectar (a mesma técnica de editores colaborativos como o Google Docs — CRDT, com a biblioteca Yjs). Com três ou mais pessoas, qualquer uma online repassa as novidades às outras.

## Privacidade

- O link carrega uma **chave secreta**. Quem não tem o link não encontra nem lê nada.
- **P2P:** os dados vão direto de aparelho para aparelho, pela conexão cifrada do WebRTC. Para os aparelhos se encontrarem, o app usa infraestrutura pública e gratuita (rastreadores BitTorrent e relays Nostr, os dois ao mesmo tempo). Por eles passa só o “aperto de mão” (cifrado com a chave do link), nunca as notas.
- **Servidor:** tudo é cifrado no aparelho (AES-256-GCM, chave derivada do link) antes de sair. O servidor guarda e repassa dados que não consegue ler.
- Só o que você escolheu compartilhar (aquela nota ou aquela pasta) participa. As outras notas continuam só suas.

## Limites do P2P

- Precisa que pelo menos duas pessoas estejam com o app aberto ao mesmo tempo para trocar as novidades.
- Algumas redes (empresas, algumas operadoras móveis) bloqueiam conexão direta entre aparelhos. Nesses casos, use o servidor de sincronização.
- No app para **Linux**, a conexão direta depende do suporte a WebRTC do sistema (WebKitGTK); se não funcionar, use o servidor ou a versão web.

## Criar o seu servidor de sincronização (opcional, grátis)

O servidor está em [`server/`](../server): um único arquivo Node.js que só guarda dados cifrados.

**Em qualquer computador ou VPS com Node.js 18+:**

```bash
cd server
npm install
PORT=8787 node collab-relay.mjs
```

**Com Docker:**

```bash
cd server
docker build -t gcp-calc-relay .
docker run -d -p 8787:8787 -v gcp-relay:/data gcp-calc-relay
```

**Em serviços gratuitos de hospedagem de Node** (Render, Railway, Fly.io, Koyeb…): crie um serviço a partir da pasta `server/` deste repositório, com o comando `npm start`. Use o endereço com **wss://** (ex.: `wss://meu-relay.onrender.com`) no campo *Endereço do servidor* ao compartilhar, ou em *Configurações → Colaboração* para ficar como padrão.

> Dica: o servidor só precisa estar no ar; ele não tem login nem painel. Quem tiver o endereço pode guardar dados cifrados nele, mas não consegue ler os de ninguém.
