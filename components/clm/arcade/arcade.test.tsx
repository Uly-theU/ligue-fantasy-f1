import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClmArcade } from './ClmArcade';

describe('ClmArcade', () => {
  it('garde le focus visible sur le premier contrôle au clavier', () => {
    render(<ClmArcade />);
    const premier = screen.getByRole('button', { name: 'Course' });
    premier.focus();
    expect(premier).toHaveFocus();
    expect(premier).toBeVisible();
    const style = window.getComputedStyle(premier);
    expect(style.display).not.toBe('none');
    expect(style.visibility).not.toBe('hidden');
  });

  it('laisse le texte du chrono dans le document avec reducedMotion', () => {
    render(<ClmArcade ecranInitial="hud" reducedMotion />);
    expect(screen.getByRole('timer')).toHaveTextContent('1:12.438');
    expect(screen.getByRole('timer')).toBeInTheDocument();
  });
});
