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
      accentSubtle: 'rgba(249, 115, 22, 0.12)',
      accentText: '#FED7AA',
      accentBorder: 'rgba(249, 115, 22, 0.35)',
      secondary: '#38BDF8',
      ground: '#0B0E17',
      surface: '#111622',
      surfaceHighlight: '#182030',
      borderSubtle: 'rgba(255, 255, 255, 0.08)',
      ambientGradient:
        'radial-gradient(circle at 50% -10%, rgba(56, 189, 248, 0.07), rgba(249, 115, 22, 0.06), transparent 70%)',
    },
  },
  fazendeiro: {
    id: 'fazendeiro',
    name: 'Fofo Fazendeiro',
    profession: 'Cultivo do Conhecimento (Diurno)',
    palette: {
      accent: '#EAB308',
      accentHover: '#CA8A04',
      accentSubtle: 'rgba(234, 179, 8, 0.12)',
      accentText: '#FEF08A',
      accentBorder: 'rgba(234, 179, 8, 0.35)',
      secondary: '#84CC16',
      ground: '#0C0F14',
      surface: '#131820',
      surfaceHighlight: '#1A232E',
      borderSubtle: 'rgba(255, 255, 255, 0.08)',
      ambientGradient:
        'radial-gradient(circle at 50% -10%, rgba(234, 179, 8, 0.07), rgba(132, 204, 22, 0.05), transparent 70%)',
    },
  },
  explorador: {
    id: 'explorador',
    name: 'Fofo Explorador',
    profession: 'Trilha do Entardecer',
    palette: {
      accent: '#EA580C',
      accentHover: '#C2410C',
      accentSubtle: 'rgba(234, 88, 12, 0.12)',
      accentText: '#FFEDD5',
      accentBorder: 'rgba(234, 88, 12, 0.35)',
      secondary: '#F59E0B',
      ground: '#0E0D14',
      surface: '#15131E',
      surfaceHighlight: '#1F1B2C',
      borderSubtle: 'rgba(255, 255, 255, 0.08)',
      ambientGradient:
        'radial-gradient(circle at 50% -10%, rgba(234, 88, 12, 0.08), rgba(245, 158, 11, 0.05), transparent 70%)',
    },
  },
  madrugada: {
    id: 'madrugada',
    name: 'Fofo Madrugada',
    profession: 'Guardião Noturno (22h ao Alvorecer)',
    palette: {
      accent: '#818CF8',
      accentHover: '#6366F1',
      accentSubtle: 'rgba(129, 140, 248, 0.12)',
      accentText: '#E0E7FF',
      accentBorder: 'rgba(129, 140, 248, 0.35)',
      secondary: '#C084FC',
      ground: '#090A13',
      surface: '#101221',
      surfaceHighlight: '#171B30',
      borderSubtle: 'rgba(255, 255, 255, 0.08)',
      ambientGradient:
        'radial-gradient(circle at 50% -10%, rgba(129, 140, 248, 0.08), rgba(192, 132, 252, 0.05), transparent 70%)',
    },
  },
  halloween: {
    id: 'halloween',
    name: 'Fofo das Bruxas & Fantasminha',
    profession: 'Temporada Assombrada (Outubro)',
    palette: {
      accent: '#FF7A00',
      accentHover: '#E06500',
      accentSubtle: 'rgba(255, 122, 0, 0.14)',
      accentText: '#FED7AA',
      accentBorder: 'rgba(255, 122, 0, 0.4)',
      secondary: '#A855F7',
      ground: '#0C0A13',
      surface: '#14101F',
      surfaceHighlight: '#1D172D',
      borderSubtle: 'rgba(255, 255, 255, 0.08)',
      ambientGradient:
        'radial-gradient(circle at 50% -10%, rgba(168, 85, 247, 0.09), rgba(255, 122, 0, 0.07), transparent 70%)',
    },
    festiveNotice: 'Clima de Halloween ativo nas molduras!',
  },
  natal: {
    id: 'natal',
    name: 'Fofo Natalino',
    profession: 'Celebração de Fim de Ano (Dezembro)',
    palette: {
      accent: '#F43F5E',
      accentHover: '#E11D48',
      accentSubtle: 'rgba(244, 63, 94, 0.12)',
      accentText: '#FFE4E6',
      accentBorder: 'rgba(244, 63, 94, 0.35)',
      secondary: '#10B981',
      ground: '#0D0B10',
      surface: '#151118',
      surfaceHighlight: '#1F1823',
      borderSubtle: 'rgba(255, 255, 255, 0.08)',
      ambientGradient:
        'radial-gradient(circle at 50% -10%, rgba(244, 63, 94, 0.08), rgba(16, 185, 129, 0.05), transparent 70%)',
    },
    festiveNotice: 'Boas festas! Moldura natalina sutil ativa.',
  },
  anonovo: {
    id: 'anonovo',
    name: 'Fofo da Virada',
    profession: 'Renovação & Metas (Ano-Novo)',
    palette: {
      accent: '#F59E0B',
      accentHover: '#D97706',
      accentSubtle: 'rgba(245, 158, 11, 0.12)',
      accentText: '#FEF3C7',
      accentBorder: 'rgba(245, 158, 11, 0.35)',
      secondary: '#38BDF8',
      ground: '#090D15',
      surface: '#0F1623',
      surfaceHighlight: '#162033',
      borderSubtle: 'rgba(255, 255, 255, 0.08)',
      ambientGradient:
        'radial-gradient(circle at 50% -10%, rgba(245, 158, 11, 0.08), rgba(56, 189, 248, 0.06), transparent 70%)',
    },
  },
  carnaval: {
    id: 'carnaval',
    name: 'Fofo Carnavalesco',
    profession: 'Alegria & Ritmo',
    palette: {
      accent: '#D946EF',
      accentHover: '#C026D3',
      accentSubtle: 'rgba(217, 70, 239, 0.12)',
      accentText: '#FAE8FF',
      accentBorder: 'rgba(217, 70, 239, 0.35)',
      secondary: '#06B6D4',
      ground: '#0D0A14',
      surface: '#151020',
      surfaceHighlight: '#201732',
      borderSubtle: 'rgba(255, 255, 255, 0.08)',
      ambientGradient:
        'radial-gradient(circle at 50% -10%, rgba(217, 70, 239, 0.08), rgba(6, 182, 212, 0.06), transparent 70%)',
    },
  },
  junina: {
    id: 'junina',
    name: 'Fofo Caipira',
    profession: 'Fogueira & Arraiá (Junho)',
    palette: {
      accent: '#EA580C',
      accentHover: '#C2410C',
      accentSubtle: 'rgba(234, 88, 12, 0.12)',
      accentText: '#FFEDD5',
      accentBorder: 'rgba(234, 88, 12, 0.35)',
      secondary: '#2563EB',
      ground: '#0E0D14',
      surface: '#15131F',
      surfaceHighlight: '#201B2E',
      borderSubtle: 'rgba(255, 255, 255, 0.08)',
      ambientGradient:
        'radial-gradient(circle at 50% -10%, rgba(234, 88, 12, 0.08), rgba(37, 99, 235, 0.05), transparent 70%)',
    },
  },
  prova: {
    id: 'prova',
    name: 'Fofo no Dia D',
    profession: 'Foco Total na Prova',
    palette: {
      accent: '#0284C7',
      accentHover: '#0369A1',
      accentSubtle: 'rgba(2, 132, 199, 0.12)',
      accentText: '#E0F2FE',
      accentBorder: 'rgba(2, 132, 199, 0.35)',
      secondary: '#64748B',
      ground: '#0A0C10',
      surface: '#10141B',
      surfaceHighlight: '#161B24',
      borderSubtle: 'rgba(255, 255, 255, 0.08)',
      ambientGradient:
        'radial-gradient(circle at 50% -10%, rgba(2, 132, 199, 0.06), rgba(100, 116, 139, 0.04), transparent 70%)',
    },
  },
  nomeado: {
    id: 'nomeado',
    name: 'Fofo Nomeado no D.O.U.',
    profession: 'Servidor Público Empossado',
    palette: {
      accent: '#10B981',
      accentHover: '#059669',
      accentSubtle: 'rgba(16, 185, 129, 0.12)',
      accentText: '#D1FAE5',
      accentBorder: 'rgba(16, 185, 129, 0.35)',
      secondary: '#F59E0B',
      ground: '#09100D',
      surface: '#0F1A15',
      surfaceHighlight: '#162720',
      borderSubtle: 'rgba(255, 255, 255, 0.08)',
      ambientGradient:
        'radial-gradient(circle at 50% -10%, rgba(16, 185, 129, 0.08), rgba(245, 158, 11, 0.06), transparent 70%)',
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
