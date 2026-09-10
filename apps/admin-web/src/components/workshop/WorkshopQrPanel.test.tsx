import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkshopQrPanel } from './WorkshopQrPanel';

const WORKSHOP_URL = 'https://grace-members.vercel.app/workshop.html';

describe('WorkshopQrPanel', () => {
  it('shows a graceful empty state when no workshop URL is known for the church', () => {
    render(<WorkshopQrPanel workshopUrl={null} />);
    expect(screen.getByText(/isn't available for this church yet/i)).toBeInTheDocument();
    expect(screen.queryByAltText(/QR code/i)).not.toBeInTheDocument();
  });

  it('renders the QR image pointed at the workshop URL via the api.qrserver.com pattern', () => {
    render(<WorkshopQrPanel workshopUrl={WORKSHOP_URL} />);
    const img = screen.getByAltText(/QR code/i) as HTMLImageElement;
    expect(img.src).toContain('https://api.qrserver.com/v1/create-qr-code/');
    expect(img.src).toContain(encodeURIComponent(WORKSHOP_URL));
  });

  it('shows the URL in a read-only input and an "Open in new tab" link', () => {
    render(<WorkshopQrPanel workshopUrl={WORKSHOP_URL} />);
    const input = screen.getByDisplayValue(WORKSHOP_URL) as HTMLInputElement;
    expect(input).toHaveAttribute('readonly');
    const link = screen.getByRole('link', { name: /open in new tab/i });
    expect(link).toHaveAttribute('href', WORKSHOP_URL);
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('copies the URL to the clipboard and shows a confirmation', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<WorkshopQrPanel workshopUrl={WORKSHOP_URL} />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));

    expect(writeText).toHaveBeenCalledWith(WORKSHOP_URL);
    expect(await screen.findByText(/copied!/i)).toBeInTheDocument();
  });
});
