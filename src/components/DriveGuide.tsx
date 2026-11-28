/** Guia passo a passo para criar o cliente OAuth do Google Drive (com links diretos ao Console). */
import { ExternalLink, FileJson, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Modal } from './ui';
import { openUrl } from '../lib/platform';
import { useLang } from '../i18n';

interface Step {
  title: string;
  body: string[];
  link?: [string, string];
}
interface Guide {
  title: string;
  intro: string[];
  steps: Step[];
  problemsTitle: string;
  problems: [string, string][];
  safety: string;
  importBtn: string;
  github: string;
}

const C = 'https://console.cloud.google.com';

const GUIDES: Record<'pt' | 'en' | 'es', Guide> = {
  pt: {
    title: 'Configurar o Google Drive — passo a passo',
    intro: [
      'Leva cerca de 10 minutos e é feito uma única vez. O mesmo arquivo JSON serve para todos os seus aparelhos (computador e celular).',
      'O GCP-Calc só acessa uma pasta oculta e exclusiva dele no seu Drive (escopo drive.appdata): ele não vê nem altera seus outros arquivos.',
    ],
    steps: [
      { title: 'Crie um projeto no Google Cloud', body: ['Entre com a sua conta Google, dê o nome “GCP-Calc” e clique em Criar.', 'Depois, confira no topo da página se o projeto GCP-Calc está selecionado.'], link: ['Criar projeto', `${C}/projectcreate`] },
      { title: 'Ative a Google Drive API', body: ['Na página da API, clique em Ativar.'], link: ['Abrir a Google Drive API', `${C}/apis/library/drive.googleapis.com`] },
      { title: 'Configure a tela de consentimento', body: ['Clique em Começar (ou “Configurar a tela de consentimento”).', 'Nome do app: GCP-Calc · E-mail de suporte: o seu.', 'Público: Externo · Informações de contato: o seu e-mail · aceite os termos e clique em Criar.'], link: ['Abrir a Plataforma de autenticação', `${C}/auth/overview`] },
      { title: 'Adicione a permissão da pasta do app', body: ['Em Acesso a dados → Adicionar ou remover escopos, procure por drive.appdata.', 'Marque “.../auth/drive.appdata” → Atualizar → Salvar.'], link: ['Abrir Acesso a dados', `${C}/auth/scopes`] },
      { title: 'Libere o seu acesso', body: ['Em Público, clique em Publicar app (recomendado): assim você não precisa reconectar a cada 7 dias.', 'Ou, se preferir deixar “Em teste”, adicione o seu e-mail em Usuários de teste.', 'Ao entrar, o Google pode avisar “app não verificado”: toque em Avançado → Acessar GCP-Calc. É o seu próprio app.'], link: ['Abrir Público', `${C}/auth/audience`] },
      { title: 'Crie a credencial e baixe o JSON', body: ['Em Clientes → Criar cliente → Tipo de aplicativo: App para computador (Desktop app).', 'Dê um nome (ex.: GCP-Calc) → Criar → Baixar JSON.', 'Importante: tem que ser “App para computador” — o tipo “Aplicativo da Web” não funciona.'], link: ['Abrir Clientes', `${C}/auth/clients`] },
      { title: 'Importe o JSON no GCP-Calc', body: ['Aqui em Configurações → Backup e sincronização → Importar JSON do Google, escolha o arquivo baixado (client_secret_….json).', 'No celular, mande o arquivo para você mesmo (e-mail, Drive, WhatsApp) e importe do mesmo jeito.', 'Se preferir, use “Digitar manualmente” e cole o Client ID e o Client secret.'] },
      { title: 'Conecte e defina a frase-senha', body: ['Toque em Conectar, entre com a sua conta Google e permita o acesso. No celular, se o navegador não voltar sozinho, volte ao GCP-Calc: o login termina em segundos.', 'Defina a frase-senha da criptografia (mínimo 8 caracteres). Use a mesma em todos os aparelhos — ela nunca sai do aparelho e não pode ser recuperada.'] },
      { title: 'Nos outros aparelhos', body: ['Importe o mesmo JSON, conecte com a mesma conta Google e use a mesma frase-senha. A sincronização automática mantém tudo espelhado.'] },
    ],
    problemsTitle: 'Se algo der errado',
    problems: [
      ['“Acesso bloqueado” ou erro 403 access_denied', 'Publique o app (passo 5) ou adicione o seu e-mail em Usuários de teste.'],
      ['redirect_uri_mismatch ou invalid_request', 'O cliente foi criado como “Aplicativo da Web”. Crie outro do tipo “App para computador” e importe o novo JSON.'],
      ['“Google Drive API has not been used” / API desativada', 'Ative a Google Drive API (passo 2) e aguarde 2–5 minutos.'],
      ['Pede para conectar de novo toda semana', 'O app está “Em teste”. Em Público, clique em Publicar app.'],
      ['Outro aparelho não abre os dados', 'A frase-senha precisa ser exatamente a mesma em todos os aparelhos.'],
    ],
    safety: 'O JSON e a frase-senha ficam só no aparelho. Tudo é cifrado com AES-256-GCM antes de ir para o Drive.',
    importBtn: 'Importar JSON do Google',
    github: 'Ver o guia completo no GitHub',
  },
  en: {
    title: 'Set up Google Drive — step by step',
    intro: [
      'It takes about 10 minutes and is done only once. The same JSON file works on all your devices (desktop and phone).',
      'GCP-Calc only accesses its own hidden folder in your Drive (drive.appdata scope): it can’t see or change your other files.',
    ],
    steps: [
      { title: 'Create a Google Cloud project', body: ['Sign in, name it “GCP-Calc” and click Create.', 'Then make sure the GCP-Calc project is selected at the top of the page.'], link: ['Create project', `${C}/projectcreate`] },
      { title: 'Enable the Google Drive API', body: ['On the API page, click Enable.'], link: ['Open Google Drive API', `${C}/apis/library/drive.googleapis.com`] },
      { title: 'Configure the consent screen', body: ['Click Get started (or “Configure consent screen”).', 'App name: GCP-Calc · Support email: yours.', 'Audience: External · Contact information: your email · accept and click Create.'], link: ['Open Google Auth Platform', `${C}/auth/overview`] },
      { title: 'Add the app-folder permission', body: ['In Data access → Add or remove scopes, search for drive.appdata.', 'Tick “.../auth/drive.appdata” → Update → Save.'], link: ['Open Data access', `${C}/auth/scopes`] },
      { title: 'Allow your account', body: ['In Audience, click Publish app (recommended) so you don’t have to reconnect every 7 days.', 'Or keep it “Testing” and add your email under Test users.', 'Google may warn “app not verified”: tap Advanced → Go to GCP-Calc. It is your own app.'], link: ['Open Audience', `${C}/auth/audience`] },
      { title: 'Create the credential and download the JSON', body: ['In Clients → Create client → Application type: Desktop app.', 'Name it (e.g. GCP-Calc) → Create → Download JSON.', 'It must be “Desktop app” — the “Web application” type does not work.'], link: ['Open Clients', `${C}/auth/clients`] },
      { title: 'Import the JSON into GCP-Calc', body: ['Here in Settings → Backup & sync → Import Google JSON, pick the downloaded file (client_secret_….json).', 'On the phone, send the file to yourself (email, Drive, chat) and import it the same way.', 'Or use “Type manually” and paste the Client ID and Client secret.'] },
      { title: 'Connect and set the passphrase', body: ['Tap Connect, sign in and allow access. On the phone, if the browser doesn’t return by itself, go back to GCP-Calc: sign-in finishes in seconds.', 'Set the encryption passphrase (8+ characters). Use the same one on every device — it never leaves the device and can’t be recovered.'] },
      { title: 'On your other devices', body: ['Import the same JSON, connect with the same Google account and use the same passphrase. Auto-sync keeps everything mirrored.'] },
    ],
    problemsTitle: 'Troubleshooting',
    problems: [
      ['“Access blocked” or 403 access_denied', 'Publish the app (step 5) or add your email under Test users.'],
      ['redirect_uri_mismatch or invalid_request', 'The client was created as “Web application”. Create a “Desktop app” client and import the new JSON.'],
      ['“Google Drive API has not been used” / disabled', 'Enable the Google Drive API (step 2) and wait 2–5 minutes.'],
      ['Asks to reconnect every week', 'The app is in “Testing”. In Audience, click Publish app.'],
      ['Another device can’t open the data', 'The passphrase must be exactly the same on all devices.'],
    ],
    safety: 'The JSON and the passphrase stay on the device. Everything is encrypted with AES-256-GCM before it goes to Drive.',
    importBtn: 'Import Google JSON',
    github: 'Full guide on GitHub',
  },
  es: {
    title: 'Configurar Google Drive — paso a paso',
    intro: [
      'Lleva unos 10 minutos y se hace una sola vez. El mismo archivo JSON sirve para todos tus dispositivos (computadora y móvil).',
      'GCP-Calc solo accede a una carpeta oculta y exclusiva en tu Drive (alcance drive.appdata): no ve ni cambia tus otros archivos.',
    ],
    steps: [
      { title: 'Crea un proyecto en Google Cloud', body: ['Inicia sesión, ponle el nombre “GCP-Calc” y haz clic en Crear.', 'Luego verifica arriba que el proyecto GCP-Calc esté seleccionado.'], link: ['Crear proyecto', `${C}/projectcreate`] },
      { title: 'Activa la Google Drive API', body: ['En la página de la API, haz clic en Habilitar.'], link: ['Abrir Google Drive API', `${C}/apis/library/drive.googleapis.com`] },
      { title: 'Configura la pantalla de consentimiento', body: ['Haz clic en Comenzar (o “Configurar pantalla de consentimiento”).', 'Nombre: GCP-Calc · Correo de asistencia: el tuyo.', 'Público: Externo · Contacto: tu correo · acepta y haz clic en Crear.'], link: ['Abrir Google Auth Platform', `${C}/auth/overview`] },
      { title: 'Agrega el permiso de la carpeta de la app', body: ['En Acceso a los datos → Agregar o quitar permisos, busca drive.appdata.', 'Marca “.../auth/drive.appdata” → Actualizar → Guardar.'], link: ['Abrir Acceso a los datos', `${C}/auth/scopes`] },
      { title: 'Habilita tu acceso', body: ['En Público, haz clic en Publicar app (recomendado) para no reconectar cada 7 días.', 'O déjala “En prueba” y agrega tu correo en Usuarios de prueba.', 'Google puede avisar “app no verificada”: toca Avanzado → Ir a GCP-Calc. Es tu propia app.'], link: ['Abrir Público', `${C}/auth/audience`] },
      { title: 'Crea la credencial y descarga el JSON', body: ['En Clientes → Crear cliente → Tipo: App de escritorio.', 'Ponle un nombre → Crear → Descargar JSON.', 'Debe ser “App de escritorio”: el tipo “Aplicación web” no funciona.'], link: ['Abrir Clientes', `${C}/auth/clients`] },
      { title: 'Importa el JSON en GCP-Calc', body: ['Aquí en Configuración → Copia y sincronización → Importar JSON de Google, elige el archivo descargado (client_secret_….json).', 'En el móvil, envíate el archivo (correo, Drive, chat) e impórtalo igual.', 'O usa “Escribir manualmente” y pega el Client ID y el Client secret.'] },
      { title: 'Conecta y define la frase de contraseña', body: ['Toca Conectar, inicia sesión y permite el acceso. En el móvil, si el navegador no vuelve solo, regresa a GCP-Calc: el inicio termina en segundos.', 'Define la frase de cifrado (8+ caracteres). Usa la misma en todos los dispositivos: nunca sale del dispositivo y no se puede recuperar.'] },
      { title: 'En tus otros dispositivos', body: ['Importa el mismo JSON, conecta con la misma cuenta de Google y usa la misma frase. La sincronización automática mantiene todo igual.'] },
    ],
    problemsTitle: 'Si algo falla',
    problems: [
      ['“Acceso bloqueado” o 403 access_denied', 'Publica la app (paso 5) o agrega tu correo en Usuarios de prueba.'],
      ['redirect_uri_mismatch o invalid_request', 'El cliente se creó como “Aplicación web”. Crea uno de tipo “App de escritorio” e importa el nuevo JSON.'],
      ['“Google Drive API has not been used” / desactivada', 'Activa la Google Drive API (paso 2) y espera 2–5 minutos.'],
      ['Pide reconectar cada semana', 'La app está “En prueba”. En Público, haz clic en Publicar app.'],
      ['Otro dispositivo no abre los datos', 'La frase debe ser exactamente la misma en todos los dispositivos.'],
    ],
    safety: 'El JSON y la frase quedan solo en el dispositivo. Todo se cifra con AES-256-GCM antes de ir a Drive.',
    importBtn: 'Importar JSON de Google',
    github: 'Guía completa en GitHub',
  },
};

export function DriveGuide({ open, onClose, onImport, githubUrl }: { open: boolean; onClose(): void; onImport(): void; githubUrl: string }) {
  const lang = useLang();
  const g = GUIDES[lang === 'en' || lang === 'es' ? lang : 'pt'];
  return (
    <Modal open={open} onClose={onClose} wide title={g.title}>
      <div className="dguide">
        {g.intro.map((p, i) => (
          <p key={i} className="dg-intro">
            {p}
          </p>
        ))}
        <ol className="dg-steps">
          {g.steps.map((s, i) => (
            <li key={i}>
              <span className="dg-n">{i + 1}</span>
              <div>
                <b>{s.title}</b>
                {s.body.map((l, j) => (
                  <p key={j}>{l}</p>
                ))}
                {s.link && (
                  <button className="btn sm" onClick={() => openUrl(s.link![1])}>
                    {s.link[0]} <ExternalLink size={12} />
                  </button>
                )}
                {i === 6 && (
                  <button className="btn sm primary grad" onClick={onImport}>
                    <FileJson size={14} /> {g.importBtn}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
        <h4 className="dg-h">
          <TriangleAlert size={15} /> {g.problemsTitle}
        </h4>
        <div className="dg-probs">
          {g.problems.map(([q, a], i) => (
            <div key={i}>
              <b>{q}</b>
              <p>{a}</p>
            </div>
          ))}
        </div>
        <p className="dg-safe">
          <ShieldCheck size={15} /> {g.safety}
        </p>
        <button className="link" onClick={() => openUrl(githubUrl)}>
          {g.github} <ExternalLink size={11} />
        </button>
      </div>
    </Modal>
  );
}

/** Lê o JSON baixado do Google Cloud ("installed" = App para computador; "web" também é aceito, com aviso). */
export function parseGoogleClientJson(text: string): { clientId: string; clientSecret?: string; kind: 'installed' | 'web' | 'other' } | null {
  try {
    const o = JSON.parse(text);
    const c = o.installed ?? o.web ?? o;
    const id = String(c.client_id ?? '').trim();
    if (!/\.apps\.googleusercontent\.com$/.test(id)) return null;
    return { clientId: id, clientSecret: c.client_secret ? String(c.client_secret).trim() : undefined, kind: o.installed ? 'installed' : o.web ? 'web' : 'other' };
  } catch {
    return null;
  }
}
