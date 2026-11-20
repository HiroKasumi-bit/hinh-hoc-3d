import { beforeEach, describe, expect, it } from 'vitest';
import { parseSmartInput } from '../parser';
import { evalDerivative2D, findFunctionIntersections2D } from '../geometry2d';
import {
  clampAndSnapXY,
  intersectRayHorizontalPlaneZ,
  pickMagneticPoint3D,
} from '../geometry3d';
import { useGeometryStore } from '../../store/useGeometryStore';
import { solveVietnameseMathProblem } from '../../../functions/_lib/problemEngine';
import {
  checkRateLimit,
  createSessionCookie,
  derivePasscodeHashHex,
  recordFailedAttempt,
  verifyPasscode,
  verifySessionCookie,
  type AuthEnv,
  type KVNamespaceLike,
} from '../../../functions/_lib/security';

function makeMockKv(): KVNamespaceLike {
  const store = new Map<string, string>();
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

describe('GeoGebra 3D Solids, Oxyz Semicolons, Function Calculus & Problem Security', () => {
  beforeEach(() => {
    useGeometryStore.getState().clearScene('all');
  });

  it('parses Vietnamese semicolon Oxyz coordinates accurately', () => {
    const p1 = parseSmartInput('A(1; 2; 3)', '3d');
    expect(p1).toEqual({
      kind: 'point3d',
      name: 'A',
      coords: [1, 2, 3],
      exprCoords: undefined,
    });

    const p2 = parseSmartInput('B(-1.5; 2; 0)', '3d');
    expect(p2).toEqual({
      kind: 'point3d',
      name: 'B',
      coords: [-1.5, 2, 0],
      exprCoords: undefined,
    });
  });

  it('computes numerical derivatives and function-function intersections', () => {
    const slope = evalDerivative2D('x^3 - 3*x + 2', 2, {});
    expect(slope).not.toBeNull();
    expect(slope!).toBeCloseTo(9, 4);

    const intersections = findFunctionIntersections2D('x^2', 'x + 2', -5, 5, {});
    expect(intersections.length).toBe(2);
    expect(intersections[0][0]).toBeCloseTo(-1, 2);
    expect(intersections[0][1]).toBeCloseTo(1, 2);
    expect(intersections[1][0]).toBeCloseTo(2, 2);
    expect(intersections[1][1]).toBeCloseTo(4, 2);
  });

  it('defaults 3D segment tool to tetrahedron and supports 2-click GeoGebra regular solids + net', () => {
    expect(useGeometryStore.getState().segment3DMode).toBe('tetrahedron');

    // 2-click Regular Tetrahedron
    useGeometryStore.getState().setTool3D('tetrahedron');
    useGeometryStore.getState().handleGround3DConstructionClick([0, 0, 0]);
    useGeometryStore.getState().handleGround3DConstructionClick([3, 0, 0]);
    let state = useGeometryStore.getState();
    expect(state.scene3d.polyhedra.length).toBe(1);
    expect(state.scene3d.polyhedra[0].kind).toBe('tetrahedron');
    expect(state.scene3d.polyhedra[0].vertexIds.length).toBe(4);
    expect(state.scene3d.polyhedra[0].faces.length).toBe(4);

    // Net unfolding
    state.createNetForPolyhedron(state.scene3d.polyhedra[0].id);
    state = useGeometryStore.getState();
    const nets = state.scene3d.nets ?? [];
    expect(nets.length).toBe(1);
    expect(state.sliders.some((sl) => sl.name === nets[0].sliderName)).toBe(true);

    // 2-click Cube
    state.clearScene('all');
    state.setTool3D('cube');
    state.handleGround3DConstructionClick([0, 0, 0]);
    state.handleGround3DConstructionClick([2, 0, 0]);
    state = useGeometryStore.getState();
    expect(state.scene3d.polyhedra.length).toBe(1);
    expect(state.scene3d.polyhedra[0].kind).toBe('box');
    expect(state.scene3d.polyhedra[0].vertexIds.length).toBe(8);
    expect(state.scene3d.polyhedra[0].faces.length).toBe(6);

    // Multi-vertex base closure + apex Pyramid (4-vertex base -> 'pyramid')
    state.clearScene('all');
    state.setTool3D('pyramid');
    state.handleGround3DConstructionClick([0, 0, 0]);
    state.handleGround3DConstructionClick([4, 0, 0]);
    state.handleGround3DConstructionClick([4, 4, 0]);
    state.handleGround3DConstructionClick([0, 4, 0]);
    const firstPtId = useGeometryStore.getState().scene3d.points[0].id;
    useGeometryStore.getState().handlePoint3DClick(firstPtId); // Close base
    useGeometryStore.getState().handleGround3DConstructionClick([2, 2, 0]); // Apex
    state = useGeometryStore.getState();
    expect(state.scene3d.polyhedra.length).toBe(1);
    expect(state.scene3d.polyhedra[0].kind).toBe('pyramid');
    expect(state.scene3d.polyhedra[0].vertexIds.length).toBe(5);
  });

  it('solves Vietnamese THPT math problems across space geometry, Oxyz, and 2D functions', () => {
    const sabcd = solveVietnameseMathProblem(
      'Cho hình chóp S.ABCD có đáy ABCD là hình vuông cạnh 4, SA vuông góc với đáy, SA = 5. Gọi M là trung điểm SC, N là trung điểm SB. Vẽ thiết diện (AMN) và tính khoảng cách từ A đến (SCD).'
    );
    expect(sabcd.mode).toBe('3d');
    expect(sabcd.snapshot.scene3d.polyhedra.length).toBeGreaterThanOrEqual(1);
    expect(sabcd.snapshot.scene3d.crossSections.length).toBeGreaterThanOrEqual(1);

    const tet = solveVietnameseMathProblem(
      'Cho tứ diện đều ABCD cạnh 4. Gọi M là trung điểm CD, G là trọng tâm tam giác BCD. Tính góc giữa đường thẳng AM và mặt phẳng (BCD).'
    );
    expect(tet.mode).toBe('3d');
    expect(tet.snapshot.scene3d.polyhedra.length).toBe(1);
    expect(tet.snapshot.scene3d.points.some((p) => p.name === 'M')).toBe(true);

    const oxyz = solveVietnameseMathProblem(
      'Trong không gian Oxyz cho A(1; 2; 0), B(3; 0; 2), C(0; 3; 1) và mặt phẳng (P): x + y + z - 3 = 0. Tìm hình chiếu của A lên (P) và vẽ mặt cầu tâm I(1; 1; 1) bán kính 2.'
    );
    expect(oxyz.mode).toBe('3d');
    expect(oxyz.showAxes).toBe(true);
    expect(oxyz.snapshot.scene3d.planes.length).toBeGreaterThanOrEqual(1);
    expect(oxyz.snapshot.scene3d.solids.length).toBeGreaterThanOrEqual(1);

    const fn2d = solveVietnameseMathProblem(
      'Khảo sát và vẽ đồ thị hàm số y = x^3 - 3x + 2, vẽ tiếp tuyến tại x = 2 và tính diện tích hình phẳng giới hạn bởi đồ thị trên đoạn [-1; 2].'
    );
    expect(fn2d.mode).toBe('2d');
    expect(fn2d.showAxes).toBe(true);
    expect(fn2d.snapshot.scene2d.functions.length).toBeGreaterThanOrEqual(1);
  });

  it('enforces PBKDF2 passcode hash, HMAC cookie User-Agent binding, and KV brute-force lock', async () => {
    const dummyPass = 'dummy-unit-test-only';
    const saltHex = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
    const expectedHash = await derivePasscodeHashHex(dummyPass, saltHex);

    const env: AuthEnv = {
      PROBLEM_LOCK_SALT: saltHex,
      PROBLEM_LOCK_HASH: expectedHash,
      SESSION_HMAC_SECRET: 'test-hmac-secret-0123456789abcdef',
      RATE_LIMIT_SALT: 'test-rl-salt-0123',
      AUTH_LOCK_KV: makeMockKv(),
    };

    expect(await verifyPasscode(dummyPass, env)).toBe(true);
    expect(await verifyPasscode('wrong-passcode', env)).toBe(false);

    const req = new Request('https://hinh-hoc-3d.pages.dev/api/problem-auth/unlock', {
      method: 'POST',
      headers: {
        'user-agent': 'Vitest-UA/1.0',
        'cf-connecting-ip': '203.0.113.10',
      },
    });
    const cookieHeader = await createSessionCookie(req, env);
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('SameSite=Strict');
    const cookiePair = cookieHeader.split(';')[0];

    const authedReq = new Request('https://hinh-hoc-3d.pages.dev/api/problem-draw', {
      headers: {
        'user-agent': 'Vitest-UA/1.0',
        cookie: cookiePair,
      },
    });
    expect(await verifySessionCookie(authedReq, env)).toBe(true);

    // Tampered cookie must fail (both mid-signature flip & trailing char flip)
    const eqPos = cookiePair.indexOf('=');
    const dotPos = cookiePair.indexOf('.', eqPos);
    const tamperedSig =
      cookiePair.slice(0, dotPos + 5) +
      (cookiePair[dotPos + 5] === 'A' ? 'B' : 'A') +
      cookiePair.slice(dotPos + 6);
    const tamperedReq = new Request('https://hinh-hoc-3d.pages.dev/api/problem-draw', {
      headers: {
        'user-agent': 'Vitest-UA/1.0',
        cookie: tamperedSig,
      },
    });
    expect(await verifySessionCookie(tamperedReq, env)).toBe(false);

    const trailingTamperReq = new Request('https://hinh-hoc-3d.pages.dev/api/problem-draw', {
      headers: {
        'user-agent': 'Vitest-UA/1.0',
        cookie: `${cookiePair.slice(0, -1)}${cookiePair.endsWith('a') ? 'b' : 'a'}`,
      },
    });
    expect(await verifySessionCookie(trailingTamperReq, env)).toBe(false);

    // Different User-Agent must fail
    const wrongUaReq = new Request('https://hinh-hoc-3d.pages.dev/api/problem-draw', {
      headers: {
        'user-agent': 'Attacker-UA/2.0',
        cookie: cookiePair,
      },
    });
    expect(await verifySessionCookie(wrongUaReq, env)).toBe(false);

    // Brute force rate limit locks on 5th failed attempt
    for (let i = 0; i < 4; i++) {
      await recordFailedAttempt(req, env);
      const st = await checkRateLimit(req, env);
      expect(st.allowed).toBe(true);
    }
    const fifth = await recordFailedAttempt(req, env);
    expect(fifth.lockedUntil).not.toBeNull();
    const blocked = await checkRateLimit(req, env);
    expect(blocked.allowed).toBe(false);
  });

  it('captures closing vertex cleanly by screen pixels and un-snapped distance in 3D', () => {
    const candidates = [
      { id: 'ptA', screenX: 400, screenY: 300, worldPos: [0, 0, 0] as [number, number, number] },
      { id: 'ptD', screenX: 422, screenY: 304, worldPos: [0.4, 0.1, 0] as [number, number, number] },
    ];

    // Even when slightly offset below ptA (30px away) and closer to ptD in raw px, priorityCloseId wins
    const closeHit = pickMagneticPoint3D({
      candidates,
      pointerX: 416,
      pointerY: 325,
      rawGroundPos: [0.3, 0.2, 0],
      priorityCloseId: 'ptA',
      isTouch: false,
    });
    expect(closeHit).toBe('ptA');

    // Without priorityCloseId: picks closest point inside 24px radius, returns null outside
    expect(
      pickMagneticPoint3D({
        candidates: [{ id: 'ptA', screenX: 400, screenY: 300, worldPos: [0, 0, 0] }],
        pointerX: 415,
        pointerY: 312,
        isTouch: false,
      })
    ).toBe('ptA');

    expect(
      pickMagneticPoint3D({
        candidates: [{ id: 'ptA', screenX: 400, screenY: 300, worldPos: [0, 0, 0] }],
        pointerX: 460,
        pointerY: 360,
        rawGroundPos: [2.5, 2.5, 0],
        isTouch: false,
      })
    ).toBeNull();
  });

  it('intersects horizontal XY plane at arbitrary height z and toggles XY <-> Z drag mode cleanly', () => {
    // Ray from Three.js scene (y_scene=6, x_scene=1, z_scene=2) pointing downward (-y_scene) intersects math z=2 cleanly!
    const dirLen = Math.hypot(1, -2, 0.5);
    const hit = intersectRayHorizontalPlaneZ(
      [1, 6, 2],
      [1 / dirLen, -2 / dirLen, 0.5 / dirLen],
      2
    );
    expect(hit).not.toBeNull();
    // t = (2 - 6) / (-2/dirLen) = 2*dirLen -> hitScene = [1 + 2, 2, 2 + 1] = [3, 2, 3] -> math [x=3, y=3]
    expect(hit![0]).toBeCloseTo(3, 5);
    expect(hit![1]).toBeCloseTo(3, 5);

    // Nearly parallel ray returns null
    expect(intersectRayHorizontalPlaneZ([0, 2, 0], [1, 0.01, 0], 2)).toBeNull();

    // Clamp & snap helper
    expect(clampAndSnapXY(19.2, -16.4, false)).toEqual([14, -14]);
    expect(clampAndSnapXY(2.74, -1.22, true)).toEqual([2.5, -1]);

    // Store pointDragMode3D defaults to 'xy', toggles to 'z', resets to 'xy' on new selection
    const p1 = useGeometryStore.getState().addPoint3D(1, 1, 2, 'A');
    const p2 = useGeometryStore.getState().addPoint3D(3, 2, 0, 'B');
    useGeometryStore.getState().selectItem({ domain: '3d', type: 'point', id: p1 });
    expect(useGeometryStore.getState().pointDragMode3D).toBe('xy');
    useGeometryStore.getState().togglePointDragMode3D();
    expect(useGeometryStore.getState().pointDragMode3D).toBe('z');
    useGeometryStore.getState().selectItem({ domain: '3d', type: 'point', id: p2 });
    expect(useGeometryStore.getState().pointDragMode3D).toBe('xy');
  });
});
