import type { OutfitId } from './wardrobe';

export interface FofoThemeTokens {
  id: OutfitId;
  name: string;
  profession: string;
  palette: {
    accent: string;
    accentHover: string;
    accentSubtle: string;
    accentText: string;
    accentBorder: string;
    secondary: string;
    ground: string;
    surface: string;
    surfaceHighlight: string;
    borderSubtle: string;
    ambientGradient: string;
  };
  festiveNotice?: string;
}

/**
 * Paleta Oficial FofoLab (raiz FofoDeck: Laranja Hamster #F97316 + Azul Céu #38BDF8 + Warm Onyx #0B0E17).
 * Cada profissão e época comemorativa traz sua atmosfera única para a moldura/perímetro,
 * mantendo a prancheta de leitura sempre limpa, com alto contraste e zero distração.
 */
export const FOFO_THEMES: Record<OutfitId, FofoThemeTokens> = {
  fofodeck: {
    id: 'fofodeck',
    name: 'FofoDeck Clássico',
    profession: 'Estudante Focado',
    palette: {
      accent: '#F97316',
      accentHover: '#EA580C',
      accentSubtle: 'rgba(249, 115, 22, 0.14)',
      accentText: '#FED7AA',
      accentBorder: 'rgba(249, 115, 22, 0.35)',
      secondary: '#38BDF8',
      ground: '#0B0E17',
      surface: '#111622',
      surfaceHighlight: '#182030',
      borderSubtle: 'rgba(255, 255, 255, 0.08)',
      ambientGradient:
        'radial-gradient(ellipse 90% 60% at 50% -15%, rgba(56, 189, 248, 0.15), rgba(249, 115, 22, 0.12), transparent 80%)',
    },
  },
  fazendeiro: {
    id: 'fazendeiro',
    name: 'Fofo Fazendeiro',
    profession: 'Cultivo do Conhecimento (Diurno)',
    palette: {
      accent: '#EAB308',
      accentHover: '#CA8A04',
      accentSubtle: 'rgba(234, 179, 8, 0.16)',
      accentText: '#FEF08A',
      accentBorder: 'rgba(234, 179, 8, 0.4)',
      secondary: '#84CC16',
      ground: '#0D110C',
      surface: '#131A12',
      surfaceHighlight: '#1B241A',
      borderSubtle: 'rgba(234, 179, 8, 0.18)',
      ambientGradient:
        'radial-gradient(ellipse 90% 60% at 50% -15%, rgba(234, 179, 8, 0.2), rgba(132, 204, 22, 0.1), transparent 80%)',
    },
  },
  explorador: {
    id: 'explorador',
    name: 'Fofo Explorador',
    profession: 'Trilha do Entardecer',
    palette: {
      accent: '#EA580C',
      accentHover: '#C2410C',
      accentSubtle: 'rgba(234, 88, 12, 0.16)',
      accentText: '#FFEDD5',
      accentBorder: 'rgba(234, 88, 12, 0.4)',
      secondary: '#F59E0B',
      ground: '#110D17',
      surface: '#191322',
      surfaceHighlight: '#231B30',
      borderSubtle: 'rgba(234, 88, 12, 0.18)',
      ambientGradient:
        'radial-gradient(ellipse 90% 60% at 50% -15%, rgba(234, 88, 12, 0.22), rgba(245, 158, 11, 0.12), transparent 80%)',
    },
  },
  madrugada: {
    id: 'madrugada',
    name: 'Fofo Madrugada',
    profession: 'Guardião Noturno (22h ao Alvorecer)',
    palette: {
      accent: '#A78BFA',
      accentHover: '#8B5CF6',
      accentSubtle: 'rgba(167, 139, 250, 0.16)',
      accentText: '#E4DCFF',
      accentBorder: 'rgba(167, 139, 250, 0.4)',
      secondary: '#C084FC',
      ground: '#070814',
      surface: '#0E1124',
      surfaceHighlight: '#161B36',
      borderSubtle: 'rgba(129, 140, 248, 0.2)',
      ambientGradient:
        'radial-gradient(ellipse 90% 60% at 50% -15%, rgba(99, 102, 241, 0.25), rgba(192, 132, 252, 0.12), transparent 80%)',
    },
  },
  halloween: {
    id: 'halloween',
    name: 'Fofo das Bruxas & Fantasminha',
    profession: 'Temporada Assombrada (Outubro)',
    palette: {
      accent: '#FF7A00',
      accentHover: '#E06500',
      accentSubtle: 'rgba(255, 122, 0, 0.18)',
      accentText: '#FED7AA',
      accentBorder: 'rgba(255, 122, 0, 0.5)',
      secondary: '#C084FC',
      ground: '#0D0817',
      surface: '#150E24',
      surfaceHighlight: '#1F1435',
      borderSubtle: 'rgba(168, 85, 247, 0.22)',
      ambientGradient:
        'radial-gradient(ellipse 90% 60% at 50% -15%, rgba(147, 51, 234, 0.28), rgba(255, 122, 0, 0.16), transparent 80%)',
    },
  },
  natal: {
    id: 'natal',
    name: 'Fofo Natalino',
    profession: 'Celebração de Fim de Ano (Dezembro)',
    palette: {
      accent: '#E8B64C',
      accentHover: '#D19E33',
      accentSubtle: 'rgba(232, 182, 76, 0.16)',
      accentText: '#F6DFA8',
      accentBorder: 'rgba(232, 182, 76, 0.4)',
      secondary: '#10B981',
      ground: '#12080D',
      surface: '#1A0D14',
      surfaceHighlight: '#26131D',
      borderSubtle: 'rgba(244, 63, 94, 0.2)',
      ambientGradient:
        'radial-gradient(ellipse 90% 60% at 50% -15%, rgba(244, 63, 94, 0.24), rgba(16, 185, 129, 0.12), transparent 80%)',
    },
  },
  anonovo: {
    id: 'anonovo',
    name: 'Fofo da Virada',
    profession: 'Renovação & Metas (Ano-Novo)',
    palette: {
      accent: '#F59E0B',
      accentHover: '#D97706',
      accentSubtle: 'rgba(245, 158, 11, 0.16)',
      accentText: '#FEF3C7',
      accentBorder: 'rgba(245, 158, 11, 0.4)',
      secondary: '#38BDF8',
      ground: '#080C14',
      surface: '#0E1524',
      surfaceHighlight: '#152036',
      borderSubtle: 'rgba(245, 158, 11, 0.18)',
      ambientGradient:
        'radial-gradient(ellipse 90% 60% at 50% -15%, rgba(245, 158, 11, 0.22), rgba(56, 189, 248, 0.12), transparent 80%)',
    },
  },
  carnaval: {
    id: 'carnaval',
    name: 'Fofo Carnavalesco',
    profession: 'Alegria & Ritmo',
    palette: {
      accent: '#D946EF',
      accentHover: '#C026D3',
      accentSubtle: 'rgba(217, 70, 239, 0.16)',
      accentText: '#FAE8FF',
      accentBorder: 'rgba(217, 70, 239, 0.4)',
      secondary: '#06B6D4',
      ground: '#11091A',
      surface: '#1A0E28',
      surfaceHighlight: '#25143A',
      borderSubtle: 'rgba(217, 70, 239, 0.2)',
      ambientGradient:
        'radial-gradient(ellipse 90% 60% at 50% -15%, rgba(217, 70, 239, 0.24), rgba(6, 182, 212, 0.12), transparent 80%)',
    },
  },
  junina: {
    id: 'junina',
    name: 'Fofo Caipira',
    profession: 'Fogueira & Arraiá (Junho)',
    palette: {
      accent: '#EA580C',
      accentHover: '#C2410C',
      accentSubtle: 'rgba(234, 88, 12, 0.16)',
      accentText: '#FFEDD5',
      accentBorder: 'rgba(234, 88, 12, 0.4)',
      secondary: '#2563EB',
      ground: '#100C17',
      surface: '#181223',
      surfaceHighlight: '#221932',
      borderSubtle: 'rgba(234, 88, 12, 0.18)',
      ambientGradient:
        'radial-gradient(ellipse 90% 60% at 50% -15%, rgba(234, 88, 12, 0.22), rgba(37, 99, 235, 0.12), transparent 80%)',
    },
  },
  prova: {
    id: 'prova',
    name: 'Fofo no Dia D',
    profession: 'Foco Total na Prova',
    palette: {
      accent: '#F97316',
      accentHover: '#EA580C',
      accentSubtle: 'rgba(249, 115, 22, 0.14)',
      accentText: '#FED7AA',
      accentBorder: 'rgba(249, 115, 22, 0.35)',
      secondary: '#64748B',
      ground: '#080B10',
      surface: '#0F131C',
      surfaceHighlight: '#161C28',
      borderSubtle: 'rgba(2, 132, 199, 0.18)',
      ambientGradient:
        'radial-gradient(ellipse 90% 60% at 50% -15%, rgba(2, 132, 199, 0.18), rgba(100, 116, 139, 0.08), transparent 80%)',
    },
  },
  nomeado: {
    id: 'nomeado',
    name: 'Fofo Nomeado no D.O.U.',
    profession: 'Servidor Público Empossado',
    palette: {
      accent: '#D4A72C',
      accentHover: '#B88F1F',
      accentSubtle: 'rgba(212, 167, 44, 0.16)',
      accentText: '#F3E1A6',
      accentBorder: 'rgba(212, 167, 44, 0.4)',
      secondary: '#F59E0B',
      ground: '#07120D',
      surface: '#0D1E16',
      surfaceHighlight: '#142C20',
      borderSubtle: 'rgba(16, 185, 129, 0.2)',
      ambientGradient:
        'radial-gradient(ellipse 90% 60% at 50% -15%, rgba(16, 185, 129, 0.24), rgba(245, 158, 11, 0.14), transparent 80%)',
    },
  },
};

export function getFofoTheme(outfitId: OutfitId): FofoThemeTokens {
  return FOFO_THEMES[outfitId] ?? FOFO_THEMES.fofodeck;
}

/**
 * Injeta os tokens de tema como variáveis CSS customizadas no elemento raiz do documento,
 * permitindo que tanto utilitários Tailwind arbitrários quanto estilos globais respondam dinamicamente.
 */
export function applyFofoThemeToDom(theme: FofoThemeTokens, target: HTMLElement = document.documentElement) {
  const { palette } = theme;
  target.style.setProperty('--fofo-accent', palette.accent);
  target.style.setProperty('--fofo-accent-hover', palette.accentHover);
  target.style.setProperty('--fofo-accent-subtle', palette.accentSubtle);
  target.style.setProperty('--fofo-accent-text', palette.accentText);
  target.style.setProperty('--fofo-accent-border', palette.accentBorder);
  target.style.setProperty('--fofo-secondary', palette.secondary);
  target.style.setProperty('--fofo-ground', palette.ground);
  target.style.setProperty('--fofo-surface', palette.surface);
  target.style.setProperty('--fofo-surface-highlight', palette.surfaceHighlight);
  target.style.setProperty('--fofo-border-subtle', palette.borderSubtle);
  target.style.setProperty('--fofo-ambient-gradient', palette.ambientGradient);
  target.setAttribute('data-fofo-outfit', theme.id);
}
