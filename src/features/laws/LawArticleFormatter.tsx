import { Fragment, type ReactNode } from 'react';
import { renderInline } from '../../components/RichText';

export interface LawArticleFormatterProps {
  articleLabel: string;
  fullText: string;
}

const PARAGRAPH_REGEX = /^(\*{0,2}(?:§\s*\d+[ºª°]?|Parágrafo\s+[úu]nico)\*{0,2}[.\s–—\*\:]*)\s*(.*)$/i;
const INCISO_REGEX = /^([IVXLCDM]+\s*[-–—.)])\s*(.*)$/i;
const ALINEA_REGEX = /^([a-z]\))\s*(.*)$/i;
const LEGISLATIVE_NOTE_REGEX = /^\s*(?:\*\([^\)]+\)\*|\([^\)]*(?:inclu[íi]do|acrescido|redação|revogad|vetad)[^\)]*\))\s*$/i;
const ARTICLE_HEADER_REGEX = /^#{0,4}\s*\*{0,2}Art(?:igo|\.)?\s*(\d+[a-zA-Z0-9\-\wºoªa]*)\*{0,2}[.\s–—\*\:]*\s*(.*)$/i;

/**
 * Renderizador de Artigos de Lei no estilo Vade Mecum Editorial.
 * Formata caput, parágrafos (§), incisos romanos (I, II) e notas legislativas
 * com hierarquia tipográfica clara, sem markdown cru na tela.
 */
export function LawArticleFormatter({ articleLabel, fullText }: LawArticleFormatterProps) {
  if (!fullText) return null;

  const rawLines = fullText.split('\n');
  const elements: ReactNode[] = [];

  let isFirstLine = true;

  rawLines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // 1. Nota de alteração legislativa (ex: *(Redação dada pela Lei...)*)
    if (LEGISLATIVE_NOTE_REGEX.test(trimmed)) {
      elements.push(
        <p key={idx} className="mt-0.5 text-[11px] leading-normal text-slate-500 italic selection:bg-orange-500/30">
          {trimmed.replace(/^[\*\(\s]+|[\*\)\s]+$/g, '')}
        </p>
      );
      return;
    }

    // 2. Primeira linha / Caput do artigo
    if (isFirstLine) {
      isFirstLine = false;
      const artMatch = trimmed.match(ARTICLE_HEADER_REGEX);
      const caputText = artMatch ? artMatch[2] : trimmed;

      elements.push(
        <div key={idx} className="space-y-2 pb-2.5">
          <div className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
            <span>{articleLabel}</span>
          </div>
          <p className="font-serif text-[14px] leading-relaxed tracking-wide text-slate-100 selection:bg-orange-500/30">
            {renderInline(caputText)}
          </p>
        </div>
      );
      return;
    }

    // 3. Parágrafos (§ 1º, § 2º, Parágrafo único)
    const paraMatch = trimmed.match(PARAGRAPH_REGEX);
    if (paraMatch) {
      const paraLabel = paraMatch[1].replace(/[\*\:]/g, '').trim();
      const paraContent = paraMatch[2];
      elements.push(
        <div key={idx} className="mt-3.5 space-y-1.5 border-l-2 border-sky-500/35 pl-3.5 py-0.5">
          <span className="text-[11px] font-semibold tracking-wider text-sky-400 uppercase">
            {paraLabel}
          </span>
          <p className="font-serif text-[13.5px] leading-relaxed text-slate-200 selection:bg-orange-500/30">
            {renderInline(paraContent)}
          </p>
        </div>
      );
      return;
    }

    // 4. Incisos (numerais romanos: I -, II -, III -)
    const incisoMatch = trimmed.match(INCISO_REGEX);
    if (incisoMatch) {
      const romanNumeral = incisoMatch[1].trim();
      const incisoContent = incisoMatch[2];
      elements.push(
        <div
          key={idx}
          className="group mt-2.5 flex items-start gap-2.5 border-l-2 border-slate-700/60 pl-3.5 py-0.5 transition-colors hover:border-amber-400/50"
        >
          <span className="font-mono text-xs font-semibold text-amber-400/90 shrink-0 select-none pt-0.5">
            {romanNumeral}
          </span>
          <p className="font-serif text-[13.5px] leading-relaxed text-slate-200 selection:bg-orange-500/30">
            {renderInline(incisoContent)}
          </p>
        </div>
      );
      return;
    }

    // 5. Alíneas (a), b), c)...)
    const alineaMatch = trimmed.match(ALINEA_REGEX);
    if (alineaMatch) {
      const alineaLetter = alineaMatch[1].trim();
      const alineaContent = alineaMatch[2];
      elements.push(
        <div key={idx} className="mt-1.5 flex items-start gap-2 border-l-2 border-emerald-500/25 pl-6 py-0.5">
          <span className="font-mono text-xs font-medium text-emerald-400 shrink-0 select-none">
            {alineaLetter}
          </span>
          <p className="font-serif text-[13px] leading-relaxed text-slate-300 selection:bg-orange-500/30">
            {renderInline(alineaContent)}
          </p>
        </div>
      );
      return;
    }

    // 6. Texto contínuo / outro parágrafo comum
    elements.push(
      <p key={idx} className="mt-2 font-serif text-[13.5px] leading-relaxed text-slate-200 selection:bg-orange-500/30">
        {renderInline(trimmed)}
      </p>
    );
  });

  return <div className="space-y-2 text-xs">{elements}</div>;
}

