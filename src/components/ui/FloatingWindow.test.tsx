import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingWindow } from './FloatingWindow';

function renderWindow(props: Partial<Parameters<typeof FloatingWindow>[0]> = {}) {
  const onClose = vi.fn();
  const utils = render(
    <FloatingWindow open onClose={onClose} title={<span>GRACE</span>} {...props}>
      <div>window body</div>
    </FloatingWindow>,
  );
  return { onClose, ...utils };
}

beforeEach(() => {
  window.localStorage.clear();
  // Desktop-sized viewport: below 640 the window is forced fullscreen.
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
});

describe('FloatingWindow (the GRACE window shell)', () => {
  it('renders nothing when closed, body when open', () => {
    const { rerender } = render(
      <FloatingWindow open={false} onClose={() => {}} title="t"><div>hidden body</div></FloatingWindow>,
    );
    expect(screen.queryByText('hidden body')).not.toBeInTheDocument();
    rerender(<FloatingWindow open onClose={() => {}} title="t"><div>hidden body</div></FloatingWindow>);
    expect(screen.getByText('hidden body')).toBeInTheDocument();
  });

  it('is non-modal — no backdrop, aria-modal false', () => {
    renderWindow();
    const win = screen.getByTestId('floating-window');
    expect(win.getAttribute('aria-modal')).toBe('false');
  });

  it('closes on Escape from anywhere', () => {
    const { onClose } = renderWindow();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('drags by the header and keeps the new position', () => {
    renderWindow();
    const win = screen.getByTestId('floating-window');
    const header = screen.getByTestId('floating-window-header');
    const before = { left: win.style.left, top: win.style.top };

    fireEvent.pointerDown(header, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(header, { clientX: 560, clientY: 340, pointerId: 1 });
    fireEvent.pointerUp(header, { clientX: 560, clientY: 340, pointerId: 1 });

    expect(win.style.left).not.toBe(before.left);
    expect(win.style.top).not.toBe(before.top);
    expect(parseFloat(win.style.left) - parseFloat(before.left)).toBe(60);
    expect(parseFloat(win.style.top) - parseFloat(before.top)).toBe(40);
  });

  it('never lets the header be dragged off-screen', () => {
    renderWindow();
    const win = screen.getByTestId('floating-window');
    const header = screen.getByTestId('floating-window-header');

    fireEvent.pointerDown(header, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(header, { clientX: 500, clientY: 30000, pointerId: 1 });
    fireEvent.pointerUp(header, { clientX: 500, clientY: 30000, pointerId: 1 });

    // clamp: top can never exceed viewport height minus the header height
    expect(parseFloat(win.style.top)).toBeLessThanOrEqual(900 - 44);
  });

  it('resizes from the corner handle, respecting minimums', () => {
    renderWindow({ minWidth: 680, minHeight: 440 });
    const win = screen.getByTestId('floating-window');
    const handle = screen.getByTestId('floating-window-resize');
    const w0 = parseFloat(win.style.width);

    fireEvent.pointerDown(handle, { clientX: 800, clientY: 700, pointerId: 2 });
    fireEvent.pointerMove(handle, { clientX: 700, clientY: 650, pointerId: 2 });
    fireEvent.pointerUp(handle, { clientX: 700, clientY: 650, pointerId: 2 });
    expect(parseFloat(win.style.width)).toBe(w0 - 100);

    // shove far past the minimum — it must stop at minWidth/minHeight
    fireEvent.pointerDown(handle, { clientX: 700, clientY: 650, pointerId: 3 });
    fireEvent.pointerMove(handle, { clientX: -5000, clientY: -5000, pointerId: 3 });
    fireEvent.pointerUp(handle, { clientX: -5000, clientY: -5000, pointerId: 3 });
    expect(parseFloat(win.style.width)).toBe(680);
    expect(parseFloat(win.style.height)).toBe(440);
  });

  it('toggles fullscreen and reports it to a render-prop child', () => {
    render(
      <FloatingWindow open onClose={() => {}} title="t">
        {({ fullscreen }) => <div>{fullscreen ? 'is-fullscreen' : 'is-windowed'}</div>}
      </FloatingWindow>,
    );
    expect(screen.getByText('is-windowed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /fullscreen/i }));
    expect(screen.getByText('is-fullscreen')).toBeInTheDocument();
    // resize handle disappears in fullscreen — nothing to resize
    expect(screen.queryByTestId('floating-window-resize')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /restore window/i }));
    expect(screen.getByText('is-windowed')).toBeInTheDocument();
  });

  it('persists geometry under the storageKey and restores it on remount', () => {
    const { unmount } = renderWindow({ storageKey: 'test-window-geo' });
    const header = screen.getByTestId('floating-window-header');
    fireEvent.pointerDown(header, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(header, { clientX: 620, clientY: 380, pointerId: 1 });
    fireEvent.pointerUp(header, { clientX: 620, clientY: 380, pointerId: 1 });
    const moved = { left: screen.getByTestId('floating-window').style.left, top: screen.getByTestId('floating-window').style.top };
    unmount();

    renderWindow({ storageKey: 'test-window-geo' });
    const win = screen.getByTestId('floating-window');
    expect(win.style.left).toBe(moved.left);
    expect(win.style.top).toBe(moved.top);
  });

  it('ignores corrupt persisted geometry instead of rendering off-screen', () => {
    window.localStorage.setItem('test-window-geo', '{"x":"NaN-garbage"}');
    renderWindow({ storageKey: 'test-window-geo' });
    const win = screen.getByTestId('floating-window');
    expect(parseFloat(win.style.left)).toBeGreaterThanOrEqual(16);
    expect(parseFloat(win.style.top)).toBeGreaterThanOrEqual(16);
  });
});
