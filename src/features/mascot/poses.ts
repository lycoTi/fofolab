/** Poses com função (regra de identidade): cada uma aparece num momento do app, nunca de enfeite. */
export type PoseId = 'pensando' | 'dormindo' | 'comemorando';

export const POSE_LABELS: Record<PoseId, string> = {
  pensando: 'Fofo pensando',
  dormindo: 'Fofo dormindo na pausa',
  comemorando: 'Fofo comemorando com um troféu',
};
