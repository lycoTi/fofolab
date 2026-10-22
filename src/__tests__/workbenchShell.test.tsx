import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useCollapsiblePanel } from '../features/workbench-shell/useCollapsiblePanel';
import { RAIL_WIDTH, RailButton, SidePanel } from '../features/workbench-shell/SidePanel';
import { RightDock, rightDockRail, useRightDockTab, type RightDockTab } from '../features/workbench-shell/RightDock';
import { useState } from 'react';
import { summarizeExamParts } from '../features/workbench-shell/headerSummary';
import { AppHeader } from '../features/workbench-shell/AppHeader';
import type { SubjectCycleAllocation } from '../lib/cycleEngine';
import type { ExamPart } from '../types/database';

beforeEach(() => {
  localStorage.clear();
});

describe('painel lateral que recolhe em trilho', () => {
  it('lembra se o painel estava aberto ou recolhido neste computador', () => {
    const { result } = renderHook(() => useCollapsiblePanel('t_open', true));
    expect(result.current.open).toBe(true);
    act(() => result.current.setOpen(false));
    expect(localStorage.getItem('t_open')).toBe('0');

    const reopened = renderHook(() => useCollapsiblePanel('t_open', true));
    expect(reopened.result.current.open).toBe(false);
  });

  it('mudança feita pelo leitor não vira preferência (persist: false)', () => {
    const { result } = renderHook(() => useCollapsiblePanel('t_open2', true));
    act(() => result.current.setOpen(false, { persist: false }));
    expect(result.current.open).toBe(false);
    expect(localStorage.getItem('t_open2')).toBeNull();
  });

  it('recolhido, o painel vira trilho e o conteúdo continua montado mas fora do alcance do teclado', () => {
    render(
      <SidePanel
        side="left"
        label="Roteiro"
        open={false}
        width={320}
        onOpenChange={() => {}}
        collapseLabel="Recolher roteiro"
        rail={<RailButton label="Abrir roteiro" icon="📋" onClick={() => {}} />}
      >
        <textarea aria-label="campo" defaultValue="rascunho" />
      </SidePanel>
    );
    const panel = screen.getByRole('complementary', { name: 'Roteiro', hidden: true });
    expect(panel.style.width).toBe(`${RAIL_WIDTH}px`);
    const field = screen.getByLabelText('campo', { selector: 'textarea' }) as HTMLTextAreaElement;
    expect(field.value).toBe('rascunho');
    const content = field.closest('[data-panel-content]') as HTMLElement;
    expect(content.hasAttribute('inert')).toBe(true);
    expect(content.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('button', { name: 'Abrir roteiro' })).toBeTruthy();
  });

  it('a seta da borda recolhe e o trilho reabre', () => {
    const onOpenChange = vi.fn();
    const onRailClick = vi.fn();
    const rail = <RailButton label="Abrir roteiro" icon="📋" onClick={onRailClick} />;
    const { rerender } = render(
      <SidePanel side="left" label="Roteiro" open width={320} onOpenChange={onOpenChange} collapseLabel="Recolher roteiro" rail={rail}>
        <p>conteúdo</p>
      </SidePanel>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Recolher roteiro' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <SidePanel side="left" label="Roteiro" open={false} width={320} onOpenChange={onOpenChange} collapseLabel="Recolher roteiro" rail={rail}>
        <p>conteúdo</p>
      </SidePanel>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Abrir roteiro' }));
    expect(onRailClick).toHaveBeenCalled();
  });

  it('sem transição ao arrastar a divisória e para quem pediu menos movimento', () => {
    // O Vitest não processa CSS, então a regra é conferida no próprio arquivo
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
    expect(css).toMatch(/\.fofolab-resizing \.fofolab-panel[^{]*\{[^}]*transition:\s*none/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*\.fofolab-panel[\s\S]*transition:\s*none/);
  });
});

describe('coluna da direita com Copiloto e Caderno', () => {
  function DockHarness() {
    const [tab, setTab] = useState<RightDockTab>('notebook');
    const [note, setNote] = useState('');
    return (
      <RightDock
        tab={tab}
        onTabChange={setTab}
        copilot={<input aria-label="pergunta" />}
        notebook={<textarea aria-label="nota" value={note} onChange={(e) => setNote(e.target.value)} />}
      />
    );
  }

  it('Copiloto e Caderno alternam por abas sem perder o que foi digitado', () => {
    render(<DockHarness />);
    fireEvent.change(screen.getByLabelText('nota'), { target: { value: 'minha nota' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Copiloto' }));
    expect(screen.getByRole('tab', { name: 'Copiloto' }).getAttribute('aria-selected')).toBe('true');
    const notePanel = screen.getByLabelText('nota', { selector: 'textarea' }).closest('[role="tabpanel"]') as HTMLElement;
    expect(notePanel.hidden).toBe(true);

    fireEvent.click(screen.getByRole('tab', { name: 'Caderno' }));
    expect((screen.getByLabelText('nota') as HTMLTextAreaElement).value).toBe('minha nota');
  });

  it('lembra a aba escolhida', () => {
    const { result } = renderHook(() => useRightDockTab());
    expect(result.current.tab).toBe('copilot');
    act(() => result.current.setTab('notebook'));
    expect(localStorage.getItem('fofolab_layout_right_tab_v1')).toBe('notebook');
  });

  it('ícone do trilho abre a coluna já na aba certa', () => {
    const onOpenTab = vi.fn();
    render(<div>{rightDockRail({ tab: 'copilot', onOpenTab })}</div>);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Caderno' }));
    expect(onOpenTab).toHaveBeenCalledWith('notebook');
  });
});

describe('cabeçalho de ponta a ponta', () => {
  const part = (id: string, code: string, sortOrder: number): ExamPart => ({
    id,
    plan_id: 'plano',
    code,
    name: code,
    item_count: 50,
    points_per_item: 1,
    min_score: null,
    sort_order: sortOrder,
  });
  const alloc = (partId: string, coveragePercent: number) =>
    ({ subject: { exam_part_id: partId }, coveragePercent }) as unknown as SubjectCycleAllocation;

  it('resume quanto de cada prova já foi visto', () => {
    const parts = [part('p2', 'P2', 2), part('p1', 'P1', 1)];
    const allocations = [alloc('p1', 50), alloc('p1', 75), alloc('p2', 40)];
    expect(summarizeExamParts(allocations, parts)).toEqual([
      { code: 'P1', coveragePercent: 63 },
      { code: 'P2', coveragePercent: 40 },
    ]);
  });

  it('plano sem provas do edital não tem resumo de provas', () => {
    expect(summarizeExamParts([alloc('p1', 50)], [])).toEqual([]);
  });

  const header = (daysUntilExam: number | null, examParts: { code: string; coveragePercent: number }[]) => (
    <AppHeader
      hidden={false}
      planLabel="[CGU] Auditor Federal (TI)"
      daysUntilExam={daysUntilExam}
      examParts={examParts}
      modeSwitch={<span>modo</span>}
      saveStatus={<span>Salvo</span>}
      onRecalibrate={() => {}}
      blockClock={<span>relógio</span>}
    />
  );

  it('cabeçalho mostra concurso, dias e provas, e nada dos antigos botões de painel', () => {
    render(header(53, [{ code: 'P1', coveragePercent: 62 }]));
    expect(screen.getByText('53 dias')).toBeTruthy();
    expect(screen.getByText('P1 62% visto')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Tópicos|Caderno|Copiloto IA|Edital Verticalizado/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Recalibrar perfil' })).toBeTruthy();
  });

  it('sem data de prova, o cabeçalho não mostra contagem', () => {
    const { container } = render(header(null, []));
    expect(screen.queryByText(/dias?$/)).toBeNull();
    expect(container.textContent).not.toMatch(/null|NaN/);
  });
});

describe('foco do teclado ao recolher e reabrir', () => {
  function PanelHarness() {
    const [open, setOpen] = useState(true);
    return (
      <SidePanel
        side="left"
        label="Roteiro"
        open={open}
        width={320}
        onOpenChange={setOpen}
        collapseLabel="Recolher roteiro"
        rail={<RailButton label="Abrir roteiro" icon="📋" onClick={() => setOpen(true)} />}
      >
        <p>conteúdo</p>
      </SidePanel>
    );
  }

  it('recolher leva o foco ao ícone do trilho, e reabrir leva à seta de recolher', () => {
    render(<PanelHarness />);
    const collapse = screen.getByRole('button', { name: 'Recolher roteiro' });
    collapse.focus();
    fireEvent.click(collapse);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Abrir roteiro');

    fireEvent.click(screen.getByRole('button', { name: 'Abrir roteiro' }));
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Recolher roteiro');
  });
});
