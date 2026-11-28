/**
 * Botão flutuante do microfone (celular): fica acima do teclado e pode ser arrastado para
 * qualquer lugar da tela; a posição fica guardada no aparelho.
 */
import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';

const KEY = 'gcp-calc:mic-pos';
const SIZE = 56;
const DEFAULT = { right: 16, bottom: 24 };
type Pos = { right: number; bottom: number };

function load(): Pos {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (p && typeof p.right === 'number' && typeof p.bottom === 'number') return p;
  } catch {
    /* sem armazenamento */
  }
  return DEFAULT;
}
export function resetMicPosition() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* sem armazenamento */
  }
  window.dispatchEvent(new Event('gcp-mic-pos'));
}

const clampPos = (p: Pos): Pos => ({
  right: Math.max(4, Math.min(window.innerWidth - SIZE - 4, p.right)),
  bottom: Math.max(4, Math.min(window.innerHeight - SIZE - 70, p.bottom)),
});

export function VoiceFab({ onTap, label }: { onTap(): void; label: string }) {
  const [pos, setPos] = useState<Pos>(() => clampPos(load()));
  const drag = useRef<{ x: number; y: number; start: Pos; moved: boolean; id: number } | null>(null);

  useEffect(() => {
    const re = () => setPos(clampPos(load()));
    window.addEventListener('gcp-mic-pos', re);
    window.addEventListener('resize', re);
    return () => {
      window.removeEventListener('gcp-mic-pos', re);
      window.removeEventListener('resize', re);
    };
  }, []);

  return (
    <button
      className={`voice-fab mobile-only ${drag.current?.moved ? 'dragging' : ''}`}
      style={{ right: `calc(${pos.right}px + var(--safe-r, 0px))`, bottom: `calc(${pos.bottom}px + var(--safe-b, 0px) + var(--kb, 0px))` }}
      aria-label={label}
      title={label}
      // o toque no botão não tira o foco do editor (o teclado continua aberto)
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        // sem os eventos de mouse "de compatibilidade" do Android: eles caíam no fundo da janela de
        // voz recém-aberta e a fechavam (por isso só funcionava segurando o botão)
        e.preventDefault();
        drag.current = { x: e.clientX, y: e.clientY, start: pos, moved: false, id: e.pointerId };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!d.moved && Math.hypot(dx, dy) < 8) return;
        d.moved = true;
        setPos(clampPos({ right: d.start.right - dx, bottom: d.start.bottom - dy }));
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if (d.moved) {
          try {
            localStorage.setItem(KEY, JSON.stringify(pos));
          } catch {
            /* sem armazenamento */
          }
          setPos({ ...pos });
        } else setTimeout(onTap, 30);
      }}
      onPointerCancel={() => (drag.current = null)}
    >
      <Mic size={22} />
    </button>
  );
}
