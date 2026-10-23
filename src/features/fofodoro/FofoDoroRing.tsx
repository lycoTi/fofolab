export type RingTone = 'focus' | 'break' | 'long' | 'idle';

const TONE_STROKE: Record<RingTone, string> = {
  focus: 'stroke-orange-500',
  break: 'stroke-sky-400',
  long: 'stroke-teal-400',
  idle: 'stroke-slate-600',
};

const TONE_TEXT: Record<RingTone, string> = {
  focus: 'fill-white',
  break: 'fill-sky-200',
  long: 'fill-teal-200',
  idle: 'fill-slate-300',
};

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Relógio analógico do FofoDoro: o arco se completa no sentido horário conforme a fase (foco ou pausa) passa.
 * Quem pediu "reduzir movimento" vê o arco mudar sem transição.
 */
export function FofoDoroRing({
  progress,
  tone,
  timeText,
  phaseLabel,
  size = 104,
}: {
  progress: number;
  tone: RingTone;
  timeText: string;
  phaseLabel: string;
  size?: number;
}) {
  const clamped = Math.min(1, Math.max(0, progress));
  const percent = Math.round(clamped * 100);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${phaseLabel}: ${timeText} restantes (${percent}%)`}
      className="shrink-0"
    >
      <circle cx="50" cy="50" r={RADIUS} fill="none" strokeWidth="8" className="stroke-slate-800" />
      <circle
        cx="50"
        cy="50"
        r={RADIUS}
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - clamped)}
        transform="rotate(-90 50 50)"
        className={`${TONE_STROKE[tone]} transition-[stroke-dashoffset] duration-500 ease-linear motion-reduce:transition-none`}
      />
      <text x="50" y="50" textAnchor="middle" className={`${TONE_TEXT[tone]} font-mono font-bold`} fontSize="17">
        {timeText}
      </text>
      <text x="50" y="66" textAnchor="middle" className="fill-slate-400" fontSize="9">
        {phaseLabel}
      </text>
    </svg>
  );
}
