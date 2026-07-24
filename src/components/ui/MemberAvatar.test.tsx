import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemberAvatar } from './MemberAvatar';

describe('MemberAvatar', () => {
  it('renders photo when provided', () => {
    render(
      <MemberAvatar
        person={{ firstName: 'Rachel', lastName: 'Kim', photo: 'https://example.com/rachel.jpg' }}
        size="md"
      />,
    );
    const img = screen.getByRole('img', { name: 'Rachel Kim' });
    expect(img).toHaveAttribute('src', 'https://example.com/rachel.jpg');
  });

  it('falls back to initials when photo fails to load', () => {
    render(
      <MemberAvatar
        person={{ firstName: 'Kevin', lastName: 'Martinez', photo: 'https://example.com/broken.jpg' }}
        size="md"
      />,
    );
    const img = screen.getByRole('img', { name: 'Kevin Martinez' });
    fireEvent.error(img);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('KM')).toBeInTheDocument();
  });

  it('shows initials when no photo', () => {
    render(
      <MemberAvatar person={{ firstName: 'Maria', lastName: 'Garcia' }} size="sm" />,
    );
    expect(screen.getByText('MG')).toBeInTheDocument();
  });
});
