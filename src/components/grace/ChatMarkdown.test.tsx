import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMarkdown } from './ChatMarkdown';

describe('ChatMarkdown', () => {
  it('shows bold names without the asterisks', () => {
    const { container } = render(<ChatMarkdown text={'You have two Sarahs:\n- **Sarah Mitchell**\n- **Sarah Chen**'} />);
    expect(container.textContent).not.toContain('*');
    expect(screen.getByText('Sarah Mitchell').tagName).toBe('STRONG');
    expect(container.textContent).toContain('• Sarah Chen');
  });

  it('links bare URLs with a safe rel', () => {
    render(<ChatMarkdown text="Details: https://example.org/a" />);
    const a = screen.getByRole('link', { name: 'https://example.org/a' });
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
