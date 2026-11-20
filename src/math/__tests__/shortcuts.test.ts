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

  it('integrates 3D Box creation directly inside the Segment tool on the 3rd point click', () => {
    const store = useGeometryStore.getState();
    store.setTool3D('segment');
    store.setSegment3DMode('box');

    // Click 1 -> Point A
    store.handleGround3DConstructionClick([0, 0, 0]);
    expect(useGeometryStore.getState().scene3d.points.length).toBe(1);
    expect(useGeometryStore.getState().pendingIds.length).toBe(1);

    // Click 2 -> Point B + Segment AB
    useGeometryStore.getState().handleGround3DConstructionClick([3, 0, 0]);
    expect(useGeometryStore.getState().scene3d.points.length).toBe(2);
    expect(useGeometryStore.getState().scene3d.segments.length).toBe(1);
    expect(useGeometryStore.getState().pendingIds.length).toBe(2);

    // Click 3 -> Automatically builds 3D Box ABCD.A'B'C'D' and removes redundant temp segment AB!
    const dragTarget = useGeometryStore.getState().handleGround3DConstructionClick([3, 2.5, 0]);
    expect(dragTarget).toBeTruthy();
    expect(dragTarget?.pointIds.length).toBe(4); // 4 top vertices A', B', C', D'
    const s3 = useGeometryStore.getState().scene3d;
    expect(s3.points.length).toBe(8);
    expect(s3.segments.length).toBe(0);
    expect(s3.polyhedra.length).toBe(1);
    expect(s3.polyhedra[0].kind).toBe('box');
    expect(s3.polyhedra[0].faces.length).toBe(6);
  });

  it('supports switching Segment 3rd-point mode to Tetrahedron S.ABC or Segment-Only', () => {
    const store = useGeometryStore.getState();
    store.setTool3D('segment');
    store.setSegment3DMode('tetrahedron');

    store.handleGround3DConstructionClick([0, 0, 0]);
    useGeometryStore.getState().handleGround3DConstructionClick([3, 0, 0]);
    const dragTarget = useGeometryStore.getState().handleGround3DConstructionClick([1.5, 2.5, 0]);

    expect(dragTarget?.pointIds.length).toBe(1); // Apex S
    const s3 = useGeometryStore.getState().scene3d;
    expect(s3.points.length).toBe(4); // A, B, C, S
    expect(s3.segments.length).toBe(0);
    expect(s3.polyhedra.length).toBe(1);
    expect(s3.polyhedra[0].kind).toBe('tetrahedron');

    // Reset and test segmentOnly mode
    useGeometryStore.getState().clearScene('all');
    useGeometryStore.getState().setTool3D('segment');
    useGeometryStore.getState().setSegment3DMode('segmentOnly');
    useGeometryStore.getState().handleGround3DConstructionClick([0, 0, 0]);
    useGeometryStore.getState().handleGround3DConstructionClick([2, 0, 0]);
    expect(useGeometryStore.getState().pendingIds.length).toBe(0);
    expect(useGeometryStore.getState().scene3d.segments.length).toBe(1);
  });
});
