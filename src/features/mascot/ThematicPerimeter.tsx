import { useCurrentFofoTheme } from './FofoOutfitContext';

/**
 * Enfeites perimétricos temáticos do FofoLab:
 * Trazem a alma da profissão ou da época comemorativa (como as decorações que colocamos em casa
 * no Halloween, no Natal ou na colheita) nos cantos e molduras da bancada, sem encobrir
 * nem distrair a prancheta de leitura das questões.
 */
export function ThematicPerimeter() {
  const theme = useCurrentFofoTheme();

  if (theme.id === 'halloween') {
    return (
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
        {/* Teia de aranha mística no canto superior esquerdo */}
        <svg
          className="absolute left-0 top-0 h-24 w-24 opacity-60 transition-opacity duration-500"
          viewBox="0 0 100 100"
          fill="none"
          stroke="url(#web-gradient-left)"
          strokeWidth="1.2"
        >
          <defs>
            <linearGradient id="web-gradient-left" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#FF7A00" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <path d="M0,0 L100,0 M0,0 L85,45 M0,0 L60,80 M0,0 L0,100" />
          <path d="M25,0 Q22,12 0,25" />
          <path d="M50,0 Q44,24 0,50" />
          <path d="M75,0 Q66,36 0,75" />
          <path d="M100,0 Q88,48 0,100" />
          <circle cx="85" cy="45" r="1.5" fill="#FF7A00" />
        </svg>

        {/* Teia de aranha e pequeno morceguinho no canto superior direito */}
        <svg
          className="absolute right-0 top-0 h-24 w-24 opacity-60 transition-opacity duration-500"
          viewBox="0 0 100 100"
          fill="none"
          stroke="url(#web-gradient-right)"
          strokeWidth="1.2"
        >
          <defs>
            <linearGradient id="web-gradient-right" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FF7A00" />
              <stop offset="100%" stopColor="#A855F7" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <path d="M100,0 L0,0 M100,0 L15,45 M100,0 L40,80 M100,0 L100,100" />
          <path d="M75,0 Q78,12 100,25" />
          <path d="M50,0 Q56,24 100,50" />
          <path d="M25,0 Q34,36 100,75" />
          <path d="M0,0 Q12,48 100,100" />
          {/* Silhueta de morceguinho pixel */}
          <path
            d="M28,26 Q24,20 20,22 Q24,28 28,30 Q32,28 36,22 Q32,20 28,26 Z"
            fill="#C084FC"
            stroke="none"
            opacity="0.75"
          />
        </svg>
      </div>
    );
  }

  if (theme.id === 'madrugada') {
    return (
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
        {/* Constelação suave e lua no topo direito */}
        <svg
          className="absolute right-3 top-2 h-16 w-32 opacity-50 transition-opacity duration-500"
          viewBox="0 0 120 60"
          fill="none"
        >
          {/* Lua crescente */}
          <path
            d="M105,10 A8,8 0 1,0 113,24 A10,10 0 1,1 105,10 Z"
            fill="#818CF8"
            opacity="0.8"
          />
          {/* Estrelinhas cintilantes */}
          <circle cx="20" cy="18" r="1.5" fill="#E0E7FF" opacity="0.9" />
          <circle cx="45" cy="32" r="1.2" fill="#C084FC" opacity="0.7" />
          <circle cx="70" cy="12" r="1.8" fill="#818CF8" opacity="0.9" />
          <circle cx="90" cy="28" r="1.2" fill="#E0E7FF" opacity="0.6" />
          {/* Linhas de constelação muito tênues */}
          <line x1="20" y1="18" x2="45" y2="32" stroke="#818CF8" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.4" />
          <line x1="45" y1="32" x2="70" y2="12" stroke="#818CF8" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.4" />
        </svg>
      </div>
    );
  }

  if (theme.id === 'fazendeiro') {
    return (
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
        {/* Espigas de trigo dourado estilizadas no topo direito */}
        <svg
          className="absolute right-2 top-1 h-14 w-28 opacity-45 transition-opacity duration-500"
          viewBox="0 0 100 50"
          fill="none"
          stroke="#EAB308"
          strokeWidth="1.2"
        >
          <path d="M90,45 Q70,25 40,15" />
          <ellipse cx="48" cy="18" rx="4" ry="2" fill="#EAB308" opacity="0.6" />
          <ellipse cx="60" cy="24" rx="4" ry="2" fill="#EAB308" opacity="0.6" />
          <ellipse cx="72" cy="32" rx="4" ry="2" fill="#EAB308" opacity="0.6" />
        </svg>
      </div>
    );
  }

  if (theme.id === 'natal') {
    return (
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
        {/* Azevinho festivo com frutinhas nos cantos */}
        <svg
          className="absolute left-2 top-1 h-12 w-24 opacity-60 transition-opacity duration-500"
          viewBox="0 0 80 40"
          fill="none"
        >
          <path d="M10,8 Q20,2 25,12 Q30,2 40,8 Q35,18 25,20 Q15,18 10,8 Z" fill="#10B981" opacity="0.7" />
          <circle cx="23" cy="20" r="2.5" fill="#F43F5E" />
          <circle cx="28" cy="21" r="2.5" fill="#E11D48" />
          <circle cx="25" cy="25" r="2.5" fill="#F43F5E" />
        </svg>
      </div>
    );
  }

  if (theme.id === 'nomeado') {
    return (
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
        {/* Ramos de louro dourados e esmeralda */}
        <svg
          className="absolute right-3 top-1 h-12 w-24 opacity-55 transition-opacity duration-500"
          viewBox="0 0 80 40"
          fill="none"
          stroke="#F59E0B"
          strokeWidth="1.2"
        >
          <path d="M70,35 Q50,15 20,10" />
          <ellipse cx="28" cy="12" rx="3.5" ry="1.8" fill="#10B981" opacity="0.6" />
          <ellipse cx="40" cy="17" rx="3.5" ry="1.8" fill="#F59E0B" opacity="0.6" />
          <ellipse cx="52" cy="24" rx="3.5" ry="1.8" fill="#10B981" opacity="0.6" />
        </svg>
      </div>
    );
  }

  return null;
}

