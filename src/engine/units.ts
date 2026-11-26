/**
 * Unidades de medida reconhecidas pelo motor.
 * Cada unidade tem uma dimensão e um fator até a unidade-base da dimensão
 * (temperatura também usa deslocamento). Os nomes estão em PT, EN e ES,
 * no singular e no plural.
 */

export type Dim =
  | 'length'
  | 'mass'
  | 'area'
  | 'volume'
  | 'time'
  | 'temp'
  | 'data'
  | 'datarate'
  | 'speed'
  | 'energy'
  | 'power'
  | 'pressure'
  | 'angle'
  | 'frequency'
  | 'money';

export interface Unit {
  id: string;
  dim: Dim;
  /** valor_base = valor * factor + offset */
  factor: number;
  offset?: number;
  /** símbolo exibido no resultado */
  symbol: string;
  /** nomes reconhecidos (comparação sem acentos e sem diferenciar maiúsculas, exceto `cs`) */
  names: string[];
  /** nomes que diferenciam maiúsculas (ex.: MB × mb, B × b) */
  cs?: string[];
  /** só vale como destino de conversão ("em c", "to f") para evitar ambiguidades */
  targetOnly?: string[];
  /** moeda: código ISO ou tag personalizada */
  currency?: string;
}

const U = (
  id: string,
  dim: Dim,
  factor: number,
  symbol: string,
  names: string[],
  extra: Partial<Unit> = {},
): Unit => ({ id, dim, factor, symbol, names, ...extra });

const DAY = 86400;
const YEAR = 365.25 * DAY;
const MONTH = YEAR / 12;

export const UNITS: Unit[] = [
  // comprimento (base: metro)
  U('nm', 'length', 1e-9, 'nm', ['nanometer', 'nanometers', 'nanometro', 'nanometros', 'nanómetro', 'nanómetros']),
  U('um', 'length', 1e-6, 'µm', ['µm', 'micrometer', 'micrometers', 'micrometro', 'micrometros', 'micron', 'microns', 'micra']),
  U('mm', 'length', 1e-3, 'mm', ['mm', 'millimeter', 'millimeters', 'millimetre', 'milimetro', 'milimetros', 'milímetro', 'milímetros']),
  U('cm', 'length', 1e-2, 'cm', ['cm', 'centimeter', 'centimeters', 'centimetre', 'centimetro', 'centimetros', 'centímetro', 'centímetros']),
  U('dm', 'length', 1e-1, 'dm', ['dm', 'decimeter', 'decimeters', 'decimetro', 'decimetros']),
  U('m', 'length', 1, 'm', ['m', 'meter', 'meters', 'metre', 'metres', 'metro', 'metros']),
  U('km', 'length', 1000, 'km', ['km', 'kilometer', 'kilometers', 'kilometre', 'quilometro', 'quilometros', 'quilômetro', 'quilômetros', 'kilometro', 'kilometros', 'kilómetro', 'kilómetros']),
  U('in', 'length', 0.0254, 'in', ['in', 'inch', 'inches', 'polegada', 'polegadas', 'pulgada', 'pulgadas', '"']),
  U('ft', 'length', 0.3048, 'ft', ['ft', 'foot', 'feet', 'pé', 'pés', 'pie', 'pies']),
  U('yd', 'length', 0.9144, 'yd', ['yd', 'yard', 'yards', 'jarda', 'jardas', 'yarda', 'yardas']),
  U('mi', 'length', 1609.344, 'mi', ['mi', 'mile', 'miles', 'milha', 'milhas', 'milla', 'millas']),
  U('nmi', 'length', 1852, 'nmi', ['nmi', 'nautical mile', 'nautical miles', 'milha nautica', 'milhas nauticas', 'milla nautica', 'millas nauticas']),
  U('au', 'length', 149597870700, 'au', ['au', 'astronomical unit', 'astronomical units', 'unidade astronomica', 'unidades astronomicas', 'ua']),
  U('ly', 'length', 9.4607304725808e15, 'ly', ['ly', 'light year', 'light years', 'lightyear', 'lightyears', 'ano luz', 'anos luz', 'año luz', 'años luz']),

  // massa (base: quilograma)
  U('mg', 'mass', 1e-6, 'mg', ['mg', 'milligram', 'milligrams', 'miligrama', 'miligramas', 'miligramo', 'miligramos']),
  U('g', 'mass', 1e-3, 'g', ['g', 'gram', 'grams', 'gramme', 'grama', 'gramas', 'gramo', 'gramos', 'gr']),
  U('kg', 'mass', 1, 'kg', ['kg', 'kilo', 'kilos', 'kilogram', 'kilograms', 'quilo', 'quilos', 'quilograma', 'quilogramas', 'kilogramo', 'kilogramos']),
  U('t', 'mass', 1000, 't', ['t', 'ton', 'tons', 'tonne', 'tonnes', 'tonelada', 'toneladas']),
  U('lb', 'mass', 0.45359237, 'lb', ['lb', 'lbs', 'pound', 'pounds', 'libra', 'libras']),
  U('oz', 'mass', 0.028349523125, 'oz', ['oz', 'ounce', 'ounces', 'onca', 'oncas', 'onça', 'onças', 'onza', 'onzas']),
  U('st', 'mass', 6.35029318, 'st', ['stone', 'stones']),
  U('ct', 'mass', 0.0002, 'ct', ['carat', 'carats', 'quilate', 'quilates']),
  U('arroba', 'mass', 15, '@', ['arroba', 'arrobas']),

  // área (base: m²)
  U('mm2', 'area', 1e-6, 'mm²', ['mm2', 'mm²', 'square millimeter', 'square millimeters', 'milimetro quadrado', 'milimetros quadrados']),
  U('cm2', 'area', 1e-4, 'cm²', ['cm2', 'cm²', 'square centimeter', 'square centimeters', 'centimetro quadrado', 'centimetros quadrados', 'centimetro cuadrado', 'centimetros cuadrados']),
  U('m2', 'area', 1, 'm²', ['m2', 'm²', 'sqm', 'square meter', 'square meters', 'metro quadrado', 'metros quadrados', 'metro cuadrado', 'metros cuadrados']),
  U('km2', 'area', 1e6, 'km²', ['km2', 'km²', 'square kilometer', 'square kilometers', 'quilometro quadrado', 'quilometros quadrados', 'kilometro cuadrado', 'kilometros cuadrados']),
  U('ha', 'area', 1e4, 'ha', ['ha', 'hectare', 'hectares', 'hectarea', 'hectareas', 'hectárea', 'hectáreas']),
  U('acre', 'area', 4046.8564224, 'ac', ['acre', 'acres']),
  U('ft2', 'area', 0.09290304, 'ft²', ['ft2', 'ft²', 'sqft', 'square foot', 'square feet', 'pe quadrado', 'pes quadrados', 'pie cuadrado', 'pies cuadrados']),
  U('in2', 'area', 0.00064516, 'in²', ['in2', 'in²', 'square inch', 'square inches', 'polegada quadrada', 'polegadas quadradas']),
  U('alqueire', 'area', 24200, 'alq', ['alqueire', 'alqueires', 'alqueire paulista']),

  // volume (base: m³)
  U('ml', 'volume', 1e-6, 'ml', ['ml', 'milliliter', 'milliliters', 'millilitre', 'mililitro', 'mililitros']),
  U('cl', 'volume', 1e-5, 'cl', ['cl', 'centiliter', 'centiliters', 'centilitro', 'centilitros']),
  U('dl', 'volume', 1e-4, 'dl', ['dl', 'deciliter', 'deciliters', 'decilitro', 'decilitros']),
  U('l', 'volume', 1e-3, 'L', ['l', 'liter', 'liters', 'litre', 'litres', 'litro', 'litros', 'lt']),
  U('cm3', 'volume', 1e-6, 'cm³', ['cm3', 'cm³', 'cc', 'cubic centimeter', 'cubic centimeters', 'centimetro cubico', 'centimetros cubicos']),
  U('m3', 'volume', 1, 'm³', ['m3', 'm³', 'cubic meter', 'cubic meters', 'metro cubico', 'metros cubicos', 'metro cúbico', 'metros cúbicos']),
  U('gal', 'volume', 0.003785411784, 'gal', ['gal', 'gallon', 'gallons', 'galao', 'galoes', 'galão', 'galões', 'galon', 'galones', 'galón']),
  U('qt', 'volume', 0.000946352946, 'qt', ['qt', 'quart', 'quarts']),
  U('pt', 'volume', 0.000473176473, 'pt', ['pint', 'pints', 'pinta', 'pintas']),
  U('cup', 'volume', 0.00024, 'cup', ['cup', 'cups', 'xicara', 'xicaras', 'xícara', 'xícaras', 'taza', 'tazas']),
  U('floz', 'volume', 0.0000295735295625, 'fl oz', ['floz', 'fl oz', 'fluid ounce', 'fluid ounces']),
  U('tbsp', 'volume', 0.000015, 'tbsp', ['tbsp', 'tablespoon', 'tablespoons', 'colher de sopa', 'colheres de sopa', 'cucharada', 'cucharadas']),
  U('tsp', 'volume', 0.000005, 'tsp', ['tsp', 'teaspoon', 'teaspoons', 'colher de cha', 'colheres de cha', 'colher de chá', 'colheres de chá', 'cucharadita', 'cucharaditas']),
  U('bbl', 'volume', 0.158987294928, 'bbl', ['bbl', 'barrel', 'barrels', 'barril', 'barris', 'barriles']),

  // tempo (base: segundo)
  U('ms', 'time', 1e-3, 'ms', ['ms', 'millisecond', 'milliseconds', 'milissegundo', 'milissegundos', 'milisegundo', 'milisegundos']),
  U('s', 'time', 1, 's', ['s', 'sec', 'secs', 'second', 'seconds', 'seg', 'segundo', 'segundos']),
  U('min', 'time', 60, 'min', ['min', 'mins', 'minute', 'minutes', 'minuto', 'minutos']),
  U('h', 'time', 3600, 'h', ['h', 'hr', 'hrs', 'hour', 'hours', 'hora', 'horas']),
  U('day', 'time', DAY, 'd', ['d', 'day', 'days', 'dia', 'dias', 'día', 'días']),
  U('week', 'time', 7 * DAY, 'sem', ['wk', 'week', 'weeks', 'semana', 'semanas']),
  U('month', 'time', MONTH, 'mês', ['month', 'months', 'mes', 'meses', 'mês']),
  U('year', 'time', YEAR, 'ano', ['yr', 'yrs', 'year', 'years', 'ano', 'anos', 'año', 'años']),
  U('decade', 'time', 10 * YEAR, 'década', ['decade', 'decades', 'decada', 'decadas', 'década', 'décadas']),
  U('century', 'time', 100 * YEAR, 'século', ['century', 'centuries', 'seculo', 'seculos', 'século', 'séculos', 'siglo', 'siglos']),

  // temperatura (base: kelvin)
  U('c', 'temp', 1, '°C', ['°c', 'ºc', 'celsius', 'graus celsius', 'grados celsius', 'centigrados', 'centígrados'], { offset: 273.15, targetOnly: ['c'] }),
  U('f', 'temp', 5 / 9, '°F', ['°f', 'ºf', 'fahrenheit', 'graus fahrenheit', 'grados fahrenheit'], { offset: 273.15 - (32 * 5) / 9, targetOnly: ['f'] }),
  U('k', 'temp', 1, 'K', ['kelvin', 'kelvins'], { offset: 0, targetOnly: ['k'] }),

  // dados (base: byte)
  U('bit', 'data', 1 / 8, 'bit', ['bit', 'bits'], { cs: ['b'] }),
  U('byte', 'data', 1, 'B', ['byte', 'bytes'], { cs: ['B'] }),
  U('kb', 'data', 1e3, 'KB', ['kb', 'kilobyte', 'kilobytes', 'quilobyte', 'quilobytes']),
  U('mb', 'data', 1e6, 'MB', ['mb', 'megabyte', 'megabytes']),
  U('gb', 'data', 1e9, 'GB', ['gb', 'gigabyte', 'gigabytes', 'giga', 'gigas']),
  U('tb', 'data', 1e12, 'TB', ['tb', 'terabyte', 'terabytes', 'tera']),
  U('pb', 'data', 1e15, 'PB', ['pb', 'petabyte', 'petabytes']),
  U('kib', 'data', 1024, 'KiB', ['kib', 'kibibyte', 'kibibytes']),
  U('mib', 'data', 1024 ** 2, 'MiB', ['mib', 'mebibyte', 'mebibytes']),
  U('gib', 'data', 1024 ** 3, 'GiB', ['gib', 'gibibyte', 'gibibytes']),
  U('tib', 'data', 1024 ** 4, 'TiB', ['tib', 'tebibyte', 'tebibytes']),
  U('kbit', 'data', 125, 'kbit', ['kbit', 'kbits', 'kilobit', 'kilobits']),
  U('mbit', 'data', 125e3, 'Mbit', ['mbit', 'mbits', 'megabit', 'megabits']),
  U('gbit', 'data', 125e6, 'Gbit', ['gbit', 'gbits', 'gigabit', 'gigabits']),

  // taxa de transferência (base: bit/s)
  U('bps', 'datarate', 1, 'bps', ['bps', 'bit/s']),
  U('kbps', 'datarate', 1e3, 'kbps', ['kbps', 'kbit/s']),
  U('mbps', 'datarate', 1e6, 'Mbps', ['mbps', 'mbit/s', 'mega', 'megas']),
  U('gbps', 'datarate', 1e9, 'Gbps', ['gbps', 'gbit/s']),
  U('MBps', 'datarate', 8e6, 'MB/s', ['mb/s']),

  // velocidade (base: m/s)
  U('mps', 'speed', 1, 'm/s', ['m/s', 'mps', 'meters per second', 'metros por segundo']),
  U('kmh', 'speed', 1000 / 3600, 'km/h', ['km/h', 'kmh', 'kph', 'kmph', 'kilometers per hour', 'quilometros por hora', 'kilometros por hora']),
  U('mph', 'speed', 0.44704, 'mph', ['mph', 'mi/h', 'miles per hour', 'milhas por hora', 'millas por hora']),
  U('knot', 'speed', 1852 / 3600, 'kn', ['kn', 'knot', 'knots', 'nó', 'nós', 'nudo', 'nudos']),
  U('fps', 'speed', 0.3048, 'ft/s', ['ft/s', 'fps']),
  U('mach', 'speed', 340.29, 'Mach', ['mach']),

  // energia (base: joule)
  U('j', 'energy', 1, 'J', ['j', 'joule', 'joules']),
  U('kj', 'energy', 1e3, 'kJ', ['kj', 'kilojoule', 'kilojoules', 'quilojoule', 'quilojoules']),
  U('cal', 'energy', 4.184, 'cal', ['cal', 'calorie', 'calories', 'caloria', 'calorias', 'caloría', 'calorías']),
  U('kcal', 'energy', 4184, 'kcal', ['kcal', 'kilocalorie', 'kilocalories', 'quilocaloria', 'quilocalorias', 'kilocaloria', 'kilocalorias']),
  U('wh', 'energy', 3600, 'Wh', ['wh', 'watt hour', 'watt hours', 'watt hora', 'watts hora']),
  U('kwh', 'energy', 3.6e6, 'kWh', ['kwh', 'kilowatt hour', 'kilowatt hours', 'quilowatt hora', 'kilovatio hora']),
  U('mwh', 'energy', 3.6e9, 'MWh', ['mwh', 'megawatt hour', 'megawatt hours']),
  U('btu', 'energy', 1055.05585, 'BTU', ['btu', 'btus']),
  U('ev', 'energy', 1.602176634e-19, 'eV', ['ev', 'electronvolt', 'electronvolts', 'eletronvolt']),

  // potência (base: watt)
  U('w', 'power', 1, 'W', ['w', 'watt', 'watts', 'vatio', 'vatios']),
  U('kw', 'power', 1e3, 'kW', ['kw', 'kilowatt', 'kilowatts', 'quilowatt', 'quilowatts', 'kilovatio', 'kilovatios']),
  U('mw', 'power', 1e6, 'MW', ['megawatt', 'megawatts'], { cs: ['MW'] }),
  U('hp', 'power', 745.69987158227, 'hp', ['hp', 'horsepower']),
  U('cv', 'power', 735.49875, 'cv', ['cv', 'cavalo vapor', 'cavalos vapor', 'caballo de vapor', 'caballos de vapor']),

  // pressão (base: pascal)
  U('pa', 'pressure', 1, 'Pa', ['pa', 'pascal', 'pascals', 'pascais']),
  U('kpa', 'pressure', 1e3, 'kPa', ['kpa', 'kilopascal', 'kilopascals', 'quilopascal']),
  U('mpa', 'pressure', 1e6, 'MPa', ['mpa', 'megapascal', 'megapascals']),
  U('bar', 'pressure', 1e5, 'bar', ['bar', 'bars']),
  U('atm', 'pressure', 101325, 'atm', ['atm', 'atmosphere', 'atmospheres', 'atmosfera', 'atmosferas']),
  U('psi', 'pressure', 6894.757293168, 'psi', ['psi']),
  U('mmhg', 'pressure', 133.322387415, 'mmHg', ['mmhg']),

  // ângulo (base: radiano)
  U('rad', 'angle', 1, 'rad', ['rad', 'radian', 'radians', 'radiano', 'radianos', 'radián', 'radianes']),
  U('deg', 'angle', Math.PI / 180, '°', ['°', 'º', 'deg', 'degree', 'degrees', 'grau', 'graus', 'grado', 'grados']),
  U('turn', 'angle', 2 * Math.PI, 'volta', ['turn', 'turns', 'volta', 'voltas', 'vuelta', 'vueltas']),

  // frequência (base: hertz)
  U('hz', 'frequency', 1, 'Hz', ['hz', 'hertz']),
  U('khz', 'frequency', 1e3, 'kHz', ['khz', 'kilohertz']),
  U('mhz', 'frequency', 1e6, 'MHz', ['mhz', 'megahertz']),
  U('ghz', 'frequency', 1e9, 'GHz', ['ghz', 'gigahertz']),
  U('rpm', 'frequency', 1 / 60, 'rpm', ['rpm']),
];

/** Remove acentos e baixa a caixa para comparar nomes. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const byName = new Map<string, Unit>();
const byCase = new Map<string, Unit>();
const targetNames = new Map<string, Unit>();
for (const u of UNITS) {
  for (const n of u.names) if (!byName.has(fold(n))) byName.set(fold(n), u);
  for (const n of u.cs || []) byCase.set(n, u);
  for (const n of u.targetOnly || []) targetNames.set(n, u);
}

/** Maior quantidade de palavras num nome de unidade (para casar "colher de sopa"). */
export const MAX_UNIT_WORDS = Math.max(...UNITS.flatMap((u) => u.names.map((n) => n.split(' ').length)));

export function findUnit(name: string, asTarget = false): Unit | undefined {
  if (byCase.has(name)) return byCase.get(name);
  const f = fold(name);
  return byName.get(f) ?? (asTarget ? targetNames.get(f) : undefined);
}

export const unitById = (id: string) => UNITS.find((u) => u.id === id);

/** Combinações de dimensões em multiplicação e divisão. */
const MUL: Record<string, Dim> = {
  'length*length': 'area',
  'area*length': 'volume',
  'length*area': 'volume',
  'speed*time': 'length',
  'time*speed': 'length',
  'power*time': 'energy',
  'time*power': 'energy',
  'datarate*time': 'data',
  'time*datarate': 'data',
};
const DIV: Record<string, Dim> = {
  'length/time': 'speed',
  'area/length': 'length',
  'volume/area': 'length',
  'volume/length': 'area',
  'length/speed': 'time',
  'energy/time': 'power',
  'energy/power': 'time',
  'data/time': 'datarate',
  'data/datarate': 'time',
};

/** Fatores especiais quando a base de uma dimensão não é o produto das bases (dados × taxa). */
const BASE_ADJUST: Record<string, number> = { 'datarate*time': 1 / 8, 'time*datarate': 1 / 8, 'data/time': 8, 'data/datarate': 8 };

export function combine(op: '*' | '/', a: Unit, b: Unit): { dim: Dim; factor: number } | null {
  const key = `${a.dim}${op}${b.dim}`;
  const dim = op === '*' ? MUL[key] : DIV[key];
  if (!dim) return null;
  const adj = BASE_ADJUST[key] ?? 1;
  return { dim, factor: (op === '*' ? a.factor * b.factor : a.factor / b.factor) * adj };
}

/** Escolhe a unidade da dimensão cujo fator mais se aproxima (ex.: km/h para km ÷ h). */
export function unitForFactor(dim: Dim, factor: number): Unit {
  const list = UNITS.filter((u) => u.dim === dim && !u.offset);
  const exact = list.find((u) => Math.abs(u.factor - factor) / factor < 1e-9);
  if (exact) return exact;
  return list.find((u) => u.factor === 1) ?? list[0];
}

export const DIMS: Dim[] = ['length', 'mass', 'area', 'volume', 'time', 'temp', 'data', 'datarate', 'speed', 'energy', 'power', 'pressure', 'angle', 'frequency'];
