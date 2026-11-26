// Gera as capturas de tela do README (docs/screenshots) a partir do build web (vite preview em :4173).
// Uso: npx vite build && npx vite preview --port 4173 & node scripts/screenshots.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const APP_URL = process.env.APP_URL || 'http://localhost:4173/';
const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

// Cotações ilustrativas só para as capturas (o app real busca na internet).
const RATES = {
  rates: { USD: 1, BRL: 5.4, EUR: 0.92, GBP: 0.79, JPY: 152, ARS: 1010, CAD: 1.39, CHF: 0.88, BTC: 1 / 95000, ETH: 1 / 3400, MXN: 18.2, CLP: 940 },
  fetched: Date.now(),
  source: 'open.er-api.com + AwesomeAPI + CoinGecko',
};
const AI = { providers: [{ id: 'p1', kind: 'anthropic', name: 'Anthropic', apiKey: 'sk-ant-xxxxxxxx', model: 'claude-opus-5-5', checkedAt: Date.now() }], active: 'p1', inline: true };

const b = await chromium.launch();

async function shot(name, { settings = {}, locale = 'pt-BR', viewport = { width: 1440, height: 900 }, device, act, data } = {}) {
  const ctx = await b.newContext(device ? { ...device, locale } : { viewport, locale, deviceScaleFactor: 1 });
  await ctx.addInitScript(
    ([rates, settings, data]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.clear();
        if (data) localStorage.setItem('gcp-calc:data', JSON.stringify(data));
        localStorage.setItem('gcp-calc:rates', JSON.stringify(rates));
        localStorage.setItem('gcp-calc:settings', JSON.stringify({ ratesOnOpen: false, updateFrequency: 'never', ...settings }));
        sessionStorage.setItem('seeded', '1');
      }
    },
    [RATES, settings, data],
  );
  const p = await ctx.newPage();
  await p.goto(APP_URL);
  await p.waitForSelector('.sidebar, .topbar');
  await p.waitForTimeout(700);
  if (act) await act(p);
  await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + name + '.png' });
  await ctx.close();
  console.log('✓', name);
}

const scrollTo = (sel) => async (p) => {
  await p.evaluate((s) => document.querySelectorAll(s)[0]?.scrollIntoView({ block: 'start' }), sel);
};
const openSettings = (section) => async (p) => {
  await p.click('.sb-bottom .nav-link:nth-child(3)');
  await p.waitForTimeout(300);
  if (section) await p.click(`.set-nav button:nth-child(${section})`);
};

await shot('01-inicio');
await shot('02-moedas-unidades', {
  act: async (p) => {
    await p.evaluate(() => document.querySelectorAll('.bt-calc')[1]?.scrollIntoView({ block: 'start' }));
    await p.evaluate(() => document.querySelector('.content')?.scrollBy(0, -20));
  },
});
await shot('03-grafico', { act: scrollTo('.bt-chart') });
await shot('04-assistente', {
  settings: { ai: AI },
  act: async (p) => {
    await p.click('.tb-pill.ai');
    await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('.assistant')?.scrollIntoView({ block: 'center' }));
  },
});
await shot('05-assistente-passos', {
  act: async (p) => {
    await p.click('.tb-pill.ai');
    await p.waitForTimeout(300);
    await p.click('.as-wiz:nth-child(2)');
    await p.fill('.as-ask input', '50.000');
    await p.press('.as-ask input', 'Enter');
    await p.fill('.as-ask input', '1,49');
    await p.press('.as-ask input', 'Enter');
    await p.click('.as-chips .chip:nth-child(4)');
    await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('.assistant')?.scrollIntoView({ block: 'center' }));
  },
});
await shot('06-modelos', { act: async (p) => p.click('.sb-bottom .nav-link:nth-child(1)') });
await shot('07-temas', { act: openSettings() });
await shot('08-cores-sintaxe', {
  settings: { theme: 'tokyo-night' },
  act: async (p) => {
    await openSettings()(p);
    await p.evaluate(() => document.querySelectorAll('.card')[2]?.scrollIntoView({ block: 'start' }));
  },
});
await shot('09-moedas-tags', {
  settings: {},
  act: async (p) => {
    await p.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('gcp-calc:data') || 'null');
      if (d) {
        d.tags = [
          { id: 't1', name: 'milhas', rate: 0.02, of: 'BRL', updated: Date.now() },
          { id: 't2', name: 'verdinha', alias: 'USD', updated: Date.now() },
        ];
        localStorage.setItem('gcp-calc:data', JSON.stringify(d));
      }
    });
    await p.reload();
    await p.waitForSelector('.sidebar');
    await openSettings(3)(p);
  },
});
await shot('10-ia', { settings: { ai: AI }, act: openSettings(4) });
await shot('11-backup', { act: openSettings(5) });
await shot('12-atualizacoes', { act: openSettings(6) });
await shot('13-apoie', { act: async (p) => p.click('.topbar .heart') });
await shot('14-claro-en', { locale: 'en-US', settings: { theme: 'cloud', lang: 'en' } });
await shot('15-editor-es', { locale: 'es-ES', settings: { theme: 'catppuccin', lang: 'es' } });
// seções, moeda automática e relatório comparativo
const T0 = Date.now();
const note = (id, title, text, extra = [], days = 0) => ({ id, title, icon: 'Wallet', color: '#10b981', created: T0 - days * 86400000, updated: T0 - days * 86400000, blocks: [{ id: id + 'c', type: 'calc', text }, ...extra] });
const BUDGET = {
  version: 1, folders: [], tags: [],
  notes: [
    note('out', 'Orçamento de outubro', '#Receitas\nSalário: R$ 6.800,00\nFreela: R$ 900,00\nTotal #Receitas\n\n#Despesas\nMoradia: R$ 2.100,00\nMercado: R$ 1.150,00\nSaúde: R$ 380,00\nLazer: R$ 450,00\nTotal #Despesas\n\nSobra: #Receitas - #Despesas\nSobra %', [], 30),
    note('nov', 'Orçamento de novembro', '#Receitas\nSalário: R$ 6.800,00\nFreela: R$ 1.600,00\nTotal #Receitas\n\n#Despesas\nMoradia: R$ 2.100,00\nMercado: R$ 1.320,00\nSaúde: R$ 290,00\nLazer: R$ 610,00\nFarmácia: -R$ 85,00\nTotal #Despesas\n\nSobra: #Receitas - #Despesas\nSobra %', [{ id: 'cmp', type: 'compare', sources: ['out', 'self'], title: 'Outubro × novembro', only: 'all' }]),
  ],
};
await shot('18-secoes', { data: BUDGET, act: async (p) => p.click('.sidebar >> text=Orçamento de novembro') });
await shot('19-relatorio', { data: BUDGET, act: async (p) => (await p.click('.sidebar >> text=Orçamento de novembro'), await p.waitForTimeout(400), await p.locator('.bt-compare').scrollIntoViewIfNeeded()) });
await shot('16-android', { device: devices['Pixel 7'], settings: { theme: 'nebula' } });
await shot('17-android-teclado', {
  device: devices['Pixel 7'],
  settings: { theme: 'gruvbox', keypad: 'on' },
  act: async (p) => {
    await p.click('.calc-input');
  },
});

await b.close();
