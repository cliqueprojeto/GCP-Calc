/**
 * Banco de ícones: toda a biblioteca Lucide (mais de mil ícones, com busca) e emojis.
 * Um ícone é salvo como o nome Lucide ("Calculator") ou como o próprio emoji.
 */
import { icons, type LucideProps } from 'lucide-react';

export type IconName = keyof typeof icons;

export const ICON_NAMES = Object.keys(icons) as IconName[];

/** Seleção inicial exibida antes de buscar. */
export const FEATURED_ICONS: string[] = [
  'Calculator', 'Wallet', 'PiggyBank', 'Banknote', 'Coins', 'CreditCard', 'Receipt', 'Landmark', 'TrendingUp', 'TrendingDown', 'ChartPie', 'ChartColumn',
  'ChartLine', 'Percent', 'BadgePercent', 'DollarSign', 'Euro', 'PoundSterling', 'Bitcoin', 'ShoppingCart', 'ShoppingBag', 'Store', 'Tag', 'Gift',
  'House', 'Building', 'Car', 'Fuel', 'Plane', 'TrainFront', 'Bus', 'Bike', 'Map', 'MapPin', 'Globe', 'Luggage',
  'Utensils', 'Coffee', 'Pizza', 'Apple', 'Wine', 'ChefHat', 'Dumbbell', 'HeartPulse', 'Pill', 'Baby', 'Dog', 'Cat',
  'Briefcase', 'Laptop', 'Smartphone', 'Cpu', 'HardDrive', 'Wifi', 'Zap', 'Lightbulb', 'Sun', 'Moon', 'Droplet', 'Flame',
  'Ruler', 'Scale', 'Weight', 'Thermometer', 'Timer', 'Clock', 'Calendar', 'CalendarDays', 'Hourglass', 'Gauge', 'Compass', 'Atom',
  'FlaskConical', 'Sigma', 'Pi', 'Divide', 'Plus', 'Minus', 'X', 'Equal', 'Hash', 'Infinity', 'Binary', 'Braces',
  'GraduationCap', 'BookOpen', 'Headphones', 'Film', 'Camera', 'Palette', 'Brush', 'Hammer', 'Wrench', 'Package', 'Truck', 'Factory',
  'Users', 'User', 'Heart', 'Star', 'Sparkles', 'Rocket', 'Target', 'Trophy', 'Flag', 'Bookmark', 'Folder', 'Archive',
  'Leaf', 'Trees', 'Mountain', 'WavesHorizontal', 'Umbrella', 'Snowflake', 'Gem', 'Crown', 'Diamond', 'Shield', 'Lock', 'Key',
];

export const EMOJI_GROUPS: { id: string; emojis: string[] }[] = [
  { id: 'money', emojis: ['💰', '💵', '💶', '💷', '💴', '💳', '🪙', '🏦', '📈', '📉', '📊', '🧾', '💸', '🤑', '💹', '🏧', '🛒', '🛍️', '🏷️', '🎁'] },
  { id: 'home', emojis: ['🏠', '🏡', '🏢', '🛋️', '🛏️', '🚿', '🧹', '🔌', '💡', '🔥', '💧', '📦', '🔑', '🧰', '🪴', '🧺', '🧊', '🪟', '🚪', '📺'] },
  { id: 'travel', emojis: ['✈️', '🚗', '🚕', '🚌', '🚆', '🚲', '⛽', '🗺️', '🧳', '🏖️', '🏔️', '🏕️', '🗽', '🗼', '🌍', '🌎', '🌏', '🚢', '🛵', '🚀'] },
  { id: 'food', emojis: ['🍎', '🍕', '🍔', '🍣', '🥗', '🍝', '🥖', '🧀', '🥩', '🍰', '☕', '🍷', '🍺', '🥤', '🍳', '🥑', '🍓', '🍫', '🍪', '🧁'] },
  { id: 'work', emojis: ['💼', '💻', '🖥️', '📱', '⌨️', '🖨️', '📅', '🗓️', '⏰', '⏱️', '📝', '📌', '📎', '✏️', '📚', '🎓', '🧪', '🔬', '📐', '📏'] },
  { id: 'life', emojis: ['❤️', '💜', '💙', '💚', '💛', '🧡', '⭐', '✨', '🔥', '🎯', '🏆', '🎉', '🎵', '🎨', '📷', '🎮', '⚽', '🏋️', '🧘', '🐶'] },
  { id: 'symbols', emojis: ['➕', '➖', '✖️', '➗', '🟰', '💯', '🔢', '#️⃣', '♾️', '✅', '❌', '⚠️', '❓', '❗', '🔺', '🔻', '🔷', '🔶', '⚡', '🌀'] },
];

export const COLORS = ['#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6', '#10b981', '#84cc16', '#eab308', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#d946ef', '#a3a3a3', '#64748b', '#0f172a'];

const isEmoji = (s: string) => !/^[A-Za-z0-9]+$/.test(s);

export function NoteIcon({ name, size = 18, color, className, ...rest }: { name: string } & LucideProps) {
  if (!name) return null;
  if (isEmoji(name)) {
    return (
      <span className={'emoji-icon ' + (className ?? '')} style={{ fontSize: Number(size) * 0.95, lineHeight: 1, width: size, display: 'inline-grid', placeItems: 'center' }}>
        {name}
      </span>
    );
  }
  const C = icons[name as IconName] ?? icons.Calculator;
  return <C size={size} color={color} className={className} {...rest} />;
}
