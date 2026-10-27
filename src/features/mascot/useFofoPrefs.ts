import { useEffect, useState } from 'react';
import { OUTFIT_LABELS, type OutfitId } from './wardrobe';

/**
 * Guarda-roupa escolhido neste computador (conforto, como a largura das colunas — não é dado de estudo):
 * a roupa fixa e o "Fui nomeado!". O nomeado lembra o plano e a data da prova de quando foi marcado: plano novo ou
 * prova nova (concurso escada) voltam o Fofo ao normal sem o estudante precisar desmarcar.
 */
export const FOFO_PREFS_KEY = 'fofolab_fofo_v1';

interface PlanRef {
  id: string;
  exam_date: string | null;
}

interface StoredPrefs {
  fixedOutfit: OutfitId | null;
  appointed: { planId: string; examDate: string | null } | null;
}

const EMPTY: StoredPrefs = { fixedOutfit: null, appointed: null };

function isOutfit(value: unknown): value is OutfitId {
  return typeof value === 'string' && value in OUTFIT_LABELS;
}

/** Lê o que está guardado; qualquer valor estranho (arquivo editado à mão) vira "automática" / "não nomeado". */
function loadPrefs(): StoredPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(FOFO_PREFS_KEY) ?? 'null') as Partial<StoredPrefs> | null;
    if (!raw) return EMPTY;
    const appointed = raw.appointed && typeof raw.appointed.planId === 'string' ? raw.appointed : null;
    return { fixedOutfit: isOutfit(raw.fixedOutfit) ? raw.fixedOutfit : null, appointed };
  } catch {
    return EMPTY;
  }
}

export function useFofoPrefs(activePlan: PlanRef | null) {
  const [prefs, setPrefs] = useState<StoredPrefs>(loadPrefs);

  useEffect(() => {
    try {
      localStorage.setItem(FOFO_PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Sem localStorage (janela privada): a escolha só não é lembrada
    }
  }, [prefs]);

  const appointed =
    prefs.appointed !== null &&
    activePlan !== null &&
    prefs.appointed.planId === activePlan.id &&
    prefs.appointed.examDate === activePlan.exam_date;

  return {
    fixedOutfit: prefs.fixedOutfit,
    appointed,
    setFixedOutfit: (fixedOutfit: OutfitId | null) => setPrefs((p) => ({ ...p, fixedOutfit })),
    setAppointed: (value: boolean) =>
      setPrefs((p) => ({
        ...p,
        appointed: value && activePlan ? { planId: activePlan.id, examDate: activePlan.exam_date } : null,
      })),
  };
}
