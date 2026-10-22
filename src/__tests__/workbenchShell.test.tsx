import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useCollapsiblePanel } from '../features/workbench-shell/useCollapsiblePanel';
import { RAIL_WIDTH, RailButton, SidePanel } from '../features/workbench-shell/SidePanel';

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
