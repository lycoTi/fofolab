import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RichText } from '../components/RichText';

describe('Texto da IA com formatação', () => {
  it('mostra negrito, itálico e listas sem os símbolos crus', () => {
    const { container } = render(
      <RichText text={'### Síntese\n* **Erros:** \"Risco Fiscal\" não é componente.\n- *Armadilha* de `RI × RC`'} />
    );
    expect(container.textContent).not.toContain('**');
    expect(container.textContent).not.toContain('###');
    expect(screen.getByText('Erros:').tagName).toBe('STRONG');
    expect(screen.getByText('Armadilha').tagName).toBe('EM');
    expect(screen.getByText('RI × RC').tagName).toBe('CODE');
  });

  it('não interpreta HTML vindo da IA', () => {
    const { container } = render(<RichText text={'<img src=x onerror=alert(1)> texto'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img');
  });
});
