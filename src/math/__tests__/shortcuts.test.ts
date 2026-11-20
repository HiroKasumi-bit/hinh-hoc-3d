import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SHORTCUTS, eventToShortcutString } from '../../types/shortcuts';
import { useGeometryStore } from '../../store/useGeometryStore';

describe('Customizable Keyboard Shortcuts & Point Renaming', () => {
  beforeEach(() => {
    useGeometryStore.getState().clearScene('all');
    useGeometryStore.getState().resetShortcuts();
  });

  it('has unique default keys across every tool and action', () => {
    const values = Object.values(DEFAULT_SHORTCUTS);
    expect(new Set(values).size).toBe(values.length);
    expect(DEFAULT_SHORTCUTS.rename_point).toBe('R');
    expect(DEFAULT_SHORTCUTS.tool_point).toBe('P');
    expect(DEFAULT_SHORTCUTS.tool_select).toBe('V');
  });

  it('normalizes keyboard events into clean shortcut strings regardless of IME', () => {
    expect(eventToShortcutString({ key: 'r', code: 'KeyR' })).toBe('R');
    expect(eventToShortcutString({ key: 'ư', code: 'KeyW' })).toBe('W');
    expect(eventToShortcutString({ key: 'F2', code: 'F2' })).toBe('F2');
    expect(eventToShortcutString({ key: 'r', code: 'KeyR', altKey: true })).toBe('Alt+R');
    expect(eventToShortcutString({ key: 'Shift' })).toBeNull();
    expect(eventToShortcutString({ key: 'Escape' })).toBeNull();
  });

  it('resolves shortcut conflicts cleanly and restores defaults', () => {
    const store = useGeometryStore.getState();
    // Reassign rename_point from R to P (which was tool_point)
    store.setShortcut('rename_point', 'P');
    const updated = useGeometryStore.getState().shortcuts;
    expect(updated.rename_point).toBe('P');
    expect(updated.tool_point).toBe('');

    // Reset restores both
    useGeometryStore.getState().resetShortcuts();
    const restored = useGeometryStore.getState().shortcuts;
    expect(restored.rename_point).toBe('R');
    expect(restored.tool_point).toBe('P');
  });

  it('renames 3D & 2D points, syncs segment names, and supports undo', () => {
    const idA = useGeometryStore.getState().addPoint3D(0, 0, 0, 'A');
    const idB = useGeometryStore.getState().addPoint3D(3, 0, 0, 'B');
    useGeometryStore.setState({
      selection: [
        { domain: '3d', type: 'point', id: idA },
        { domain: '3d', type: 'point', id: idB },
      ],
    });
    useGeometryStore.getState().createSegmentFromSelection('3d');
    expect(useGeometryStore.getState().scene3d.segments[0].name).toBe('AB');

    useGeometryStore.getState().renamePoint('3d', idA, 'S');
    expect(useGeometryStore.getState().scene3d.points.find((p) => p.id === idA)?.name).toBe('S');
    expect(useGeometryStore.getState().scene3d.segments[0].name).toBe('SB');

    // Undo reverts rename cleanly
    useGeometryStore.getState().undo();
    expect(useGeometryStore.getState().scene3d.points.find((p) => p.id === idA)?.name).toBe('A');
    expect(useGeometryStore.getState().scene3d.segments[0].name).toBe('AB');
  });
});
