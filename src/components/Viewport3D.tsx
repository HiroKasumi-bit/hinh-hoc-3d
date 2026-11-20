import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { GizmoHelper, GizmoViewport, Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Axis3D, Crosshair, Eye, Layers, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { useGeometryStore, type Construction3DDragTarget } from '../store/useGeometryStore';
import { useViewportProfile } from '../hooks/useViewportProfile';
import { compileExpression } from '../math/parser';
import { formatNum } from '../math/geometry2d';
import {
  add3,
  angle3Points3DDeg,
  angleLineLineDeg,
  angleLinePlaneDeg,
  anglePlanePlaneDeg,
  centroid3,
  computePolyhedronEdgeVisibility,
  cross3,
  dist3,
  distPointToPlane,
  footPointOnPlane,
  intersectSpherePlane,
  len3,
  mathToScene,
  normalize3,
  pickMagneticPoint3D,
  planeBasis,
  planeFrom3Points,
  resolvePlaneEq,
  resolvePoints3D,
  scale3,
  sceneToMath,
  skewLinesDistance,
  slicePolyhedronByPlane,
  sub3,
} from '../math/geometry3d';
import type {
  CameraPreset3D,
  CrossSection3D,
  Curve3D,
  Net3D,
  Plane3D,
  Polyhedron3D,
  Segment3DSolidMode,
  Solid3D,
  Surface3D,
  Tool3D,
  Vec3,
} from '../types/geometry';

/** Keep Drei Html labels strictly below modals (z-[100]) and pass pointer events through unless interactive */
const Label3D: React.FC<{
  position: [number, number, number];
  children: React.ReactNode;
  interactive?: boolean;
}> = ({ position, children, interactive = false }) => (
  <Html
    position={position}
    center
    zIndexRange={[10, 0]}
    wrapperClass={interactive ? undefined : 'pointer-events-none'}
    pointerEvents={interactive ? 'auto' : 'none'}
    style={{ pointerEvents: interactive ? 'auto' : 'none' }}
  >
    {children}
  </Html>
);

interface ZDragSession {
  pointId: string;
  targetPoints: Array<{ id: string; baseZ: number }>;
  baseX: number;
  baseY: number;
  baseZ: number;
  floorZ: number;
  hudLabel: 'z' | 'h';
  startClientX: number;
  startClientY: number;
  pointerId: number;
  mode: 'create' | 'adjust';
  activated: boolean;
  moved: boolean;
  timerId: number | null;
}

interface ZDragHud {
  pointId: string;
  x: number;
  y: number;
  z: number;
  displayVal: number;
  label: 'z' | 'h';
  mode: 'create' | 'adjust';
}

// ==================== CAMERA CONTROLLER & PNG EXPORT BRIDGE ====================

const CameraRig: React.FC<{ controlsRef: React.RefObject<OrbitControlsImpl | null> }> = ({ controlsRef }) => {
  const { camera, gl, scene, size } = useThree();
  const cameraRequest = useGeometryStore((s) => s.cameraRequest);
  const scene3d = useGeometryStore((s) => s.scene3d);
  const sliders = useGeometryStore((s) => s.sliders);

  // Dynamically widen FOV on portrait phones so the full 3D ground plane & tall shapes stay framed cleanly!
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const aspect = size.width / Math.max(1, size.height);
    const targetFov = aspect < 0.75 ? 52 : aspect < 1.0 ? 45 : 38;
    if (Math.abs(camera.fov - targetFov) > 0.5) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }
  }, [camera, size.width, size.height]);

  useEffect(() => {
    if (!cameraRequest) return;
    const ctrl = controlsRef.current;

    const scope = Object.fromEntries(sliders.map((sl) => [sl.name, sl.value]));
    const ptMap = resolvePoints3D(scene3d.points, scene3d.planes, scope);
    const samplePts: Vec3[] = [];
    for (const p of scene3d.points) {
      if (p.visible) samplePts.push(ptMap.get(p.id) ?? [p.x, p.y, p.z]);
    }
    for (const s of scene3d.solids) {
      if (!s.visible) continue;
      if (s.kind === 'sphere') {
        samplePts.push(
          [s.center[0] - s.radius, s.center[1] - s.radius, s.center[2] - s.radius],
          [s.center[0] + s.radius, s.center[1] + s.radius, s.center[2] + s.radius]
        );
      } else if (s.kind === 'revolution' && s.domain) {
        const [a, b] = s.domain;
        samplePts.push([a, -2, -2], [b, 2, 2]);
      } else {
        const h = s.height ?? 3.5;
        samplePts.push(
          [s.center[0] - s.radius, s.center[1] - s.radius, s.center[2]],
          [s.center[0] + s.radius, s.center[1] + s.radius, s.center[2] + h]
        );
      }
    }

    let centerMath: Vec3 = [0, 0, 0.5];
    let radius = 3.6;
    if (samplePts.length > 0) {
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      for (const [x, y, z] of samplePts) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
      centerMath = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
      radius = Math.max(2.6, Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) * 0.58);
    }

    const dist = radius * 3.1;
    const dirMap: Record<CameraPreset3D, Vec3> = {
      oxyz: normalize3([0.74, 0.56, 0.44]),
      iso: normalize3([0.62, 0.62, 0.52]),
      top: [0.001, 0.001, 1],
      front: normalize3([1, 0.02, 0.16]),
      side: normalize3([0.02, 1, 0.16]),
    };
    const dir = dirMap[cameraRequest.preset] ?? dirMap.oxyz;
    const camMath = add3(centerMath, scale3(dir, dist));
    const [sx, sy, sz] = mathToScene(camMath);
    const [tx, ty, tz] = mathToScene(centerMath);
    camera.position.set(sx, sy, sz);
    if (ctrl) {
      ctrl.target.set(tx, ty, tz);
      ctrl.update();
    } else {
      camera.lookAt(tx, ty, tz);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraRequest, camera, controlsRef]);

  useEffect(() => {
    const handleExport = () => {
      gl.render(scene, camera);
      const url = gl.domElement.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `HinhHocViet-3D-${Date.now()}.png`;
      a.click();
    };
    window.addEventListener('hinhhocviet-export-3d', handleExport);
    return () => window.removeEventListener('hinhhocviet-export-3d', handleExport);
  }, [gl, scene, camera]);

  return null;
};

// ==================== GROUND PLANE & OPTIONAL OXYZ AXES ====================

const AxesOxyz: React.FC<{ isDark: boolean; showAxes: boolean; showGrid: boolean; showOxyPlane: boolean; showLabels: boolean }> = ({
  isDark,
  showAxes,
  showGrid,
  showOxyPlane,
  showLabels,
}) => {
  const axisLen = 6.5;
  const extent = 6;
  const gridLines = useMemo(() => {
    const segs: Array<[number, number, number]> = [];
    for (let i = -extent; i <= extent; i++) {
      segs.push(mathToScene([i, -extent, 0]), mathToScene([i, extent, 0]));
      segs.push(mathToScene([-extent, i, 0]), mathToScene([extent, i, 0]));
    }
    return segs;
  }, []);

  const borderLoop = useMemo(
    () => [
      mathToScene([-extent, -extent, 0]),
      mathToScene([extent, -extent, 0]),
      mathToScene([extent, extent, 0]),
      mathToScene([-extent, extent, 0]),
      mathToScene([-extent, -extent, 0]),
    ],
    []
  );

  const gridColor = isDark ? '#334155' : '#CFD9E6';
  const borderColor = isDark ? '#475569' : '#B6C4D6';
  const oxyFill = isDark ? '#1E293B' : '#E8EEF5';
  const tickColor = isDark ? '#94A3B8' : '#64748B';

  return (
    <group>
      {showOxyPlane && (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
            <planeGeometry args={[extent * 2, extent * 2]} />
            <meshBasicMaterial
              color={oxyFill}
              transparent
              opacity={isDark ? 0.24 : 0.42}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <Line points={borderLoop} color={borderColor} lineWidth={1.3} transparent opacity={0.85} />
        </group>
      )}

      {showGrid && (
        <Line points={gridLines} segments color={gridColor} lineWidth={1} transparent opacity={0.75} />
      )}

      {showAxes && (
        <group>
          {/* Ox (Red) */}
          <Line points={[mathToScene([-axisLen, 0, 0]), mathToScene([axisLen, 0, 0])]} color="#DC2626" lineWidth={1.8} />
          <mesh position={mathToScene([axisLen + 0.12, 0, 0])} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.09, 0.28, 14]} />
            <meshBasicMaterial color="#DC2626" />
          </mesh>

          {/* Oy (Green) */}
          <Line points={[mathToScene([0, -axisLen, 0]), mathToScene([0, axisLen, 0])]} color="#16A34A" lineWidth={1.8} />
          <mesh position={mathToScene([0, axisLen + 0.12, 0])} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.09, 0.28, 14]} />
            <meshBasicMaterial color="#16A34A" />
          </mesh>

          {/* Oz (Blue - UP!) */}
          <Line points={[mathToScene([0, 0, -axisLen * 0.6]), mathToScene([0, 0, axisLen])]} color="#2563EB" lineWidth={1.8} />
          <mesh position={mathToScene([0, 0, axisLen + 0.12])}>
            <coneGeometry args={[0.09, 0.28, 14]} />
            <meshBasicMaterial color="#2563EB" />
          </mesh>

          {showLabels && (
            <>
              <Label3D position={mathToScene([-0.26, -0.26, 0.08])}>
                <span className="font-math pointer-events-none select-none text-[11px] font-bold" style={{ color: tickColor }}>
                  O
                </span>
              </Label3D>
              <Label3D position={mathToScene([axisLen + 0.48, 0, 0])}>
                <span className="pointer-events-none select-none font-bold text-xs text-red-600">x</span>
              </Label3D>
              <Label3D position={mathToScene([0, axisLen + 0.48, 0])}>
                <span className="pointer-events-none select-none font-bold text-xs text-green-600">y</span>
              </Label3D>
              <Label3D position={mathToScene([0, 0, axisLen + 0.48])}>
                <span className="pointer-events-none select-none font-bold text-xs text-blue-600">z</span>
              </Label3D>
              {[-4, -2, 2, 4].map((v) => (
                <React.Fragment key={v}>
                  <Line points={[mathToScene([v, -0.1, 0]), mathToScene([v, 0.1, 0])]} color="#DC2626" lineWidth={1.2} />
                  <Line points={[mathToScene([-0.1, v, 0]), mathToScene([0.1, v, 0])]} color="#16A34A" lineWidth={1.2} />
                  {v > 0 && <Line points={[mathToScene([-0.1, 0, v]), mathToScene([0.1, 0, v])]} color="#2563EB" lineWidth={1.2} />}
                  <Label3D position={mathToScene([v, -0.25, 0])}>
                    <span className="font-math pointer-events-none select-none text-[10px]" style={{ color: tickColor }}>
                      {v}
                    </span>
                  </Label3D>
                  <Label3D position={mathToScene([-0.25, v, 0])}>
                    <span className="font-math pointer-events-none select-none text-[10px]" style={{ color: tickColor }}>
                      {v}
                    </span>
                  </Label3D>
                  {v > 0 && (
                    <Label3D position={mathToScene([0, -0.25, v])}>
                      <span className="font-math pointer-events-none select-none text-[10px]" style={{ color: tickColor }}>
                        {v}
                      </span>
                    </Label3D>
                  )}
                </React.Fragment>
              ))}
            </>
          )}
        </group>
      )}
    </group>
  );
};

// ==================== LIVE Z-ELEVATION GUIDE VISUALS ====================

const ZElevationGuide: React.FC<{ hud: ZDragHud; isDark: boolean }> = ({ hud, isDark }) => {
  const { x, y, z } = hud;
  const ringPts = useMemo(() => {
    const pts: Array<[number, number, number]> = [];
    const r = 0.28;
    for (let i = 0; i <= 24; i++) {
      const t = (i / 24) * Math.PI * 2;
      pts.push(mathToScene([x + r * Math.cos(t), y + r * Math.sin(t), 0.01]));
    }
    return pts;
  }, [x, y]);

  const railMin = Math.min(-1.5, z - 2.5);
  const railMax = Math.max(5.5, z + 2.5);

  return (
    <group>
      {/* Subtle full vertical rail */}
      <Line
        points={[mathToScene([x, y, railMin]), mathToScene([x, y, railMax])]}
        color="#1D5CE5"
        lineWidth={1.3}
        transparent
        opacity={0.35}
      />
      {/* Crisp dashed drop-line from ground (x,y,0) to (x,y,z) */}
      {Math.abs(z) > 0.01 && (
        <Line
          points={[mathToScene([x, y, 0]), mathToScene([x, y, z])]}
          color="#E06D1F"
          lineWidth={2.6}
          dashed
          dashSize={0.16}
          gapSize={0.1}
        />
      )}
      {/* Ground projection footprint ring at (x, y, 0) */}
      <Line points={ringPts} color="#E06D1F" lineWidth={2} />
      <mesh position={mathToScene([x, y, 0.01])}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshBasicMaterial color="#E06D1F" />
      </mesh>
      {/* Floating live elevation readout */}
      <Label3D position={mathToScene([x, y + 0.55, z + 0.35])}>
        <div
          className={`font-math pointer-events-none select-none whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-bold shadow-md ${
            isDark
              ? 'border-amber-400 bg-slate-900/95 text-amber-300'
              : 'border-amber-500 bg-amber-50/98 text-amber-900'
          }`}
        >
          ↕ {hud.label} = {formatNum(hud.displayVal, 2)}
        </div>
      </Label3D>
    </group>
  );
};

// ==================== POLYHEDRON WITH REAL-TIME AUTO-DASHED HIDDEN EDGES ====================

const PolyhedronRenderer: React.FC<{
  poly: Polyhedron3D;
  ptMap: Map<string, Vec3>;
  autoDashedGlobal: boolean;
  globalOpacity: number;
  isDark: boolean;
  isSelected: boolean;
  onSelect: (multi: boolean) => void;
}> = ({ poly, ptMap, autoDashedGlobal, globalOpacity, isDark, isSelected, onSelect }) => {
  const { camera } = useThree();
  const lastCamDir = useRef(new THREE.Vector3(99, 99, 99));
  const [hiddenMask, setHiddenMask] = useState<string>('');

  const faceGeometry = useMemo(() => {
    const positions: number[] = [];
    for (const face of poly.faces) {
      const pts = face.map((id) => ptMap.get(id)).filter((v): v is Vec3 => Boolean(v));
      if (pts.length < 3) continue;
      const p0 = mathToScene(pts[0]);
      for (let i = 1; i < pts.length - 1; i++) {
        const p1 = mathToScene(pts[i]);
        const p2 = mathToScene(pts[i + 1]);
        positions.push(...p0, ...p1, ...p2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    return geo;
  }, [poly.faces, ptMap]);

  useEffect(() => () => faceGeometry.dispose(), [faceGeometry]);

  const effectiveAutoDashed = poly.autoDashed && autoDashedGlobal;

  const camMathPos: Vec3 = sceneToMath([camera.position.x, camera.position.y, camera.position.z]);
  const edges = useMemo(() => {
    return computePolyhedronEdgeVisibility(
      { ...poly, autoDashed: effectiveAutoDashed },
      ptMap,
      camMathPos
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poly, ptMap, effectiveAutoDashed, hiddenMask]);

  useFrame(() => {
    if (!effectiveAutoDashed) return;
    const dir = camera.position.clone().normalize();
    if (dir.distanceTo(lastCamDir.current) < 0.025) return;
    lastCamDir.current.copy(dir);
    const curCamMath = sceneToMath([camera.position.x, camera.position.y, camera.position.z]);
    const nextEdges = computePolyhedronEdgeVisibility({ ...poly, autoDashed: true }, ptMap, curCamMath);
    const mask = nextEdges.map((e) => (e.isHidden ? '1' : '0')).join('');
    if (mask !== hiddenMask) setHiddenMask(mask);
  });

  const solidEdgeColor = isSelected ? '#1D5CE5' : isDark ? '#F1F5F9' : '#0F1B2D';
  const hiddenEdgeColor = isDark ? '#94A3B8' : '#64748B';
  const opacity = Math.min(0.65, Math.max(0.03, globalOpacity));

  return (
    <group>
      <mesh
        geometry={faceGeometry}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(e.shiftKey || e.ctrlKey || e.metaKey);
        }}
      >
        <meshStandardMaterial
          color={poly.color}
          transparent
          opacity={isSelected ? Math.min(0.45, opacity + 0.1) : opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
          roughness={0.55}
          metalness={0.05}
        />
      </mesh>

      {edges.map((edge) => {
        const key = `${edge.id1}-${edge.id2}`;
        const pts: [[number, number, number], [number, number, number]] = [
          mathToScene(edge.p1),
          mathToScene(edge.p2),
        ];
        return (
          <Line
            key={key}
            points={pts}
            color={edge.isHidden ? hiddenEdgeColor : solidEdgeColor}
            lineWidth={edge.isHidden ? 1.55 : 2.35}
            dashed={edge.isHidden}
            dashSize={0.22}
            gapSize={0.14}
          />
        );
      })}
    </group>
  );
};

// ==================== CROSS-SECTION POLYGON ====================

const CrossSectionRenderer: React.FC<{
  cs: CrossSection3D;
  poly: Polyhedron3D | undefined;
  planes: Plane3D[];
  ptMap: Map<string, Vec3>;
  showLabels: boolean;
  isDark: boolean;
}> = ({ cs, poly, planes, ptMap, showLabels, isDark }) => {
  const result = useMemo(() => {
    if (!poly) return null;
    let eq = null;
    if (cs.planeId) {
      const pl = planes.find((p) => p.id === cs.planeId);
      if (pl) eq = resolvePlaneEq(pl, ptMap);
    } else if (cs.pointIds) {
      const a = ptMap.get(cs.pointIds[0]);
      const b = ptMap.get(cs.pointIds[1]);
      const c = ptMap.get(cs.pointIds[2]);
      if (a && b && c) eq = planeFrom3Points(a, b, c);
    }
    if (!eq) return null;
    return slicePolyhedronByPlane(poly, ptMap, eq);
  }, [cs, poly, planes, ptMap]);

  const geometry = useMemo(() => {
    if (!result || result.vertices.length < 3) return null;
    const positions: number[] = [];
    const p0 = mathToScene(result.vertices[0]);
    for (let i = 1; i < result.vertices.length - 1; i++) {
      const p1 = mathToScene(result.vertices[i]);
      const p2 = mathToScene(result.vertices[i + 1]);
      positions.push(...p0, ...p1, ...p2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    return geo;
  }, [result]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!result || !geometry) return null;

  const loopPts = [...result.vertices, result.vertices[0]].map((v) => mathToScene(v));
  const labelAnchor = result.vertices.reduce(
    (best, v) => (v[1] > best[1] ? v : best),
    result.vertices[0]
  );
  const badgePos: Vec3 = [labelAnchor[0], labelAnchor[1] + 0.65, labelAnchor[2] + 0.35];

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={cs.color}
          transparent
          opacity={cs.opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
          roughness={0.4}
        />
      </mesh>
      <Line points={loopPts} color={cs.color} lineWidth={3.2} />
      {result.vertices.map((v, idx) => (
        <mesh key={idx} position={mathToScene(v)}>
          <sphereGeometry args={[0.075, 14, 14]} />
          <meshStandardMaterial color={cs.color} />
        </mesh>
      ))}
      {showLabels && (
        <Label3D position={mathToScene(badgePos)}>
          <div
            className={`font-math pointer-events-none select-none whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-semibold shadow-xs ${
              isDark
                ? 'border-amber-500/60 bg-slate-900/92 text-amber-300'
                : 'border-amber-500/70 bg-white/95 text-amber-800'
            }`}
          >
            Thiết diện ({result.vertices.length} cạnh) · S = {formatNum(result.area, 2)}
          </div>
        </Label3D>
      )}
    </group>
  );
};

// ==================== PLANE 3D RENDERER ====================

const Plane3DRenderer: React.FC<{
  plane: Plane3D;
  ptMap: Map<string, Vec3>;
  isSelected: boolean;
  onSelect: (multi: boolean) => void;
}> = ({ plane, ptMap, isSelected, onSelect }) => {
  const eq = useMemo(() => resolvePlaneEq(plane, ptMap), [plane, ptMap]);
  if (!eq) return null;

  const { origin, u, v, n } = planeBasis(eq);
  let center = plane.center ?? origin;
  if (plane.pointIds) {
    const pts = plane.pointIds.map((id) => ptMap.get(id)).filter((p): p is Vec3 => Boolean(p));
    if (pts.length === 3) center = centroid3(pts);
  }
  const half = plane.size / 2;

  const c1 = add3(center, add3(scale3(u, -half), scale3(v, -half)));
  const c2 = add3(center, add3(scale3(u, half), scale3(v, -half)));
  const c3 = add3(center, add3(scale3(u, half), scale3(v, half)));
  const c4 = add3(center, add3(scale3(u, -half), scale3(v, half)));

  const cornersScene = [c1, c2, c3, c4].map(mathToScene);
  const quadGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array([
      ...cornersScene[0],
      ...cornersScene[1],
      ...cornersScene[2],
      ...cornersScene[0],
      ...cornersScene[2],
      ...cornersScene[3],
    ]);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c1[0], c1[1], c1[2], c3[0], c3[1], c3[2], plane.size]);

  useEffect(() => () => quadGeo.dispose(), [quadGeo]);

  const normalEnd = add3(center, scale3(n, 1.4));

  return (
    <group>
      <mesh
        geometry={quadGeo}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(e.shiftKey || e.ctrlKey || e.metaKey);
        }}
      >
        <meshStandardMaterial
          color={plane.color}
          transparent
          opacity={isSelected ? Math.min(0.5, plane.opacity + 0.15) : plane.opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
          roughness={0.5}
        />
      </mesh>
      <Line
        points={[...cornersScene, cornersScene[0]]}
        color={plane.color}
        lineWidth={isSelected ? 2.4 : 1.35}
        transparent
        opacity={0.75}
      />
      {plane.showNormal && (
        <VectorArrow3D origin={center} tip={normalEnd} color="#7C3AED" label={`n${plane.name}`} />
      )}
    </group>
  );
};

// ==================== VECTOR ARROW 3D ====================

const VectorArrow3D: React.FC<{
  origin: Vec3;
  tip: Vec3;
  color: string;
  label?: string;
  showLabel?: boolean;
}> = ({ origin, tip, color, label, showLabel = true }) => {
  const p1 = useMemo(() => new THREE.Vector3(...mathToScene(origin)), [origin]);
  const p2 = useMemo(() => new THREE.Vector3(...mathToScene(tip)), [tip]);
  const dir = useMemo(() => p2.clone().sub(p1), [p1, p2]);
  const length = dir.length();

  const quat = useMemo(() => {
    const q = new THREE.Quaternion();
    if (length > 1e-6) {
      q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    }
    return q;
  }, [dir, length]);

  if (length < 1e-5) return null;

  const headLen = Math.min(0.32, length * 0.28);
  const shaftEnd = p1.clone().add(dir.clone().normalize().multiplyScalar(Math.max(0, length - headLen)));
  const conePos = p1.clone().add(dir.clone().normalize().multiplyScalar(length - headLen / 2));

  return (
    <group>
      <Line points={[p1.toArray(), shaftEnd.toArray()]} color={color} lineWidth={2.6} />
      <mesh position={conePos} quaternion={quat}>
        <coneGeometry args={[0.095, headLen, 14]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {label && showLabel && (
        <Label3D position={p2.clone().add(new THREE.Vector3(0, 0.22, 0)).toArray() as [number, number, number]}>
          <span
            className="font-math pointer-events-none select-none whitespace-nowrap rounded border border-violet-300/80 bg-white/92 px-1.5 py-0.5 text-[10.5px] font-semibold shadow-2xs"
            style={{ color }}
          >
            {label}
          </span>
        </Label3D>
      )}
    </group>
  );
};

// ==================== SOLIDS OF REVOLUTION ====================

const Solid3DRenderer: React.FC<{
  solid: Solid3D;
  planes: Plane3D[];
  ptMap: Map<string, Vec3>;
  sliderScope: Record<string, number>;
  showLabels: boolean;
}> = ({ solid, planes, ptMap, sliderScope, showLabels }) => {
  const centerScene = mathToScene(solid.center);

  const circlePoints = (radius: number, zOffset = 0) => {
    const pts: Array<[number, number, number]> = [];
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * Math.PI * 2;
      pts.push(
        mathToScene([
          solid.center[0] + radius * Math.cos(t),
          solid.center[1] + radius * Math.sin(t),
          solid.center[2] + zOffset,
        ])
      );
    }
    return pts;
  };

  const revGeometry = useMemo(() => {
    if (solid.kind !== 'revolution' || !solid.funcExpr || !solid.domain) return null;
    try {
      const compiled = compileExpression(solid.funcExpr);
      const [a, b] = solid.domain;
      const steps = 64;
      const pts: THREE.Vector2[] = [];
      pts.push(new THREE.Vector2(0, a));
      for (let i = 0; i <= steps; i++) {
        const x = a + ((b - a) * i) / steps;
        const r = Math.abs(compiled.eval({ ...sliderScope, x }));
        if (Number.isFinite(r)) {
          pts.push(new THREE.Vector2(Math.min(10, r), x));
        }
      }
      pts.push(new THREE.Vector2(0, b));
      const geo = new THREE.LatheGeometry(pts, 32);
      geo.rotateX(Math.PI / 2);
      return geo;
    } catch {
      return null;
    }
  }, [solid.kind, solid.funcExpr, solid.domain, sliderScope]);

  useEffect(() => () => revGeometry?.dispose(), [revGeometry]);

  const sphereCircles = useMemo(() => {
    if (solid.kind !== 'sphere') return [];
    const results: Array<{ pts: Array<[number, number, number]>; r: number; center: Vec3 }> = [];
    for (const pl of planes) {
      if (!pl.visible) continue;
      const eq = resolvePlaneEq(pl, ptMap);
      if (!eq) continue;
      const inter = intersectSpherePlane(solid.center, solid.radius, eq);
      if (inter && inter.circleRadius > 0.02) {
        const ring: Array<[number, number, number]> = [];
        for (let i = 0; i <= 72; i++) {
          const t = (i / 72) * Math.PI * 2;
          const p = add3(
            inter.circleCenter,
            add3(
              scale3(inter.basis.u, inter.circleRadius * Math.cos(t)),
              scale3(inter.basis.v, inter.circleRadius * Math.sin(t))
            )
          );
          ring.push(mathToScene(p));
        }
        results.push({ pts: ring, r: inter.circleRadius, center: inter.circleCenter });
      }
    }
    return results;
  }, [solid, planes, ptMap]);

  if (solid.kind === 'sphere') {
    return (
      <group>
        <mesh position={centerScene}>
          <sphereGeometry args={[solid.radius, 40, 28]} />
          <meshStandardMaterial
            color={solid.color}
            transparent
            opacity={solid.opacity}
            side={THREE.DoubleSide}
            depthWrite={false}
            roughness={0.35}
          />
        </mesh>
        <Line points={circlePoints(solid.radius, 0)} color={solid.color} lineWidth={1.4} dashed dashSize={0.18} gapSize={0.12} />
        {sphereCircles.map((sc, idx) => {
          const rimPos = sc.pts[Math.floor(sc.pts.length * 0.18)] ?? mathToScene(sc.center);
          return (
            <group key={idx}>
              <Line points={sc.pts} color="#D93829" lineWidth={3} />
              {showLabels && (
                <Label3D position={[rimPos[0], rimPos[1] + 0.25, rimPos[2]]}>
                  <div className="font-math pointer-events-none select-none whitespace-nowrap rounded border border-red-400/70 bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 shadow-2xs">
                    Giao tuyến r = {formatNum(sc.r, 2)}
                  </div>
                </Label3D>
              )}
            </group>
          );
        })}
      </group>
    );
  }

  if (solid.kind === 'cone') {
    const h = solid.height ?? 3.5;
    const midScene = mathToScene([solid.center[0], solid.center[1], solid.center[2] + h / 2]);
    const apex: Vec3 = [solid.center[0], solid.center[1], solid.center[2] + h];
    const rimPt: Vec3 = [solid.center[0] + solid.radius, solid.center[1], solid.center[2]];
    return (
      <group>
        <mesh position={midScene}>
          <coneGeometry args={[solid.radius, h, 48, 1, false]} />
          <meshStandardMaterial color={solid.color} transparent opacity={solid.opacity} side={THREE.DoubleSide} depthWrite={false} roughness={0.4} />
        </mesh>
        <Line points={circlePoints(solid.radius, 0)} color={solid.color} lineWidth={2} />
        {solid.showAxes && (
          <>
            <Line points={[mathToScene(solid.center), mathToScene(apex)]} color="#0F1B2D" lineWidth={1.6} dashed dashSize={0.18} gapSize={0.12} />
            <Line points={[mathToScene(solid.center), mathToScene(rimPt)]} color="#D93829" lineWidth={1.8} dashed dashSize={0.15} gapSize={0.1} />
            <Line points={[mathToScene(apex), mathToScene(rimPt)]} color={solid.color} lineWidth={2.2} />
          </>
        )}
      </group>
    );
  }

  if (solid.kind === 'cylinder') {
    const h = solid.height ?? 3.5;
    const midScene = mathToScene([solid.center[0], solid.center[1], solid.center[2] + h / 2]);
    const topCenter: Vec3 = [solid.center[0], solid.center[1], solid.center[2] + h];
    return (
      <group>
        <mesh position={midScene}>
          <cylinderGeometry args={[solid.radius, solid.radius, h, 48, 1, false]} />
          <meshStandardMaterial color={solid.color} transparent opacity={solid.opacity} side={THREE.DoubleSide} depthWrite={false} roughness={0.4} />
        </mesh>
        <Line points={circlePoints(solid.radius, 0)} color={solid.color} lineWidth={2} />
        <Line points={circlePoints(solid.radius, h)} color={solid.color} lineWidth={2} />
        {solid.showAxes && (
          <Line points={[mathToScene(solid.center), mathToScene(topCenter)]} color="#0F1B2D" lineWidth={1.6} dashed dashSize={0.18} gapSize={0.12} />
        )}
      </group>
    );
  }

  if (solid.kind === 'revolution' && revGeometry) {
    return (
      <group>
        <mesh geometry={revGeometry}>
          <meshStandardMaterial
            color={solid.color}
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
            depthWrite={false}
            roughness={0.35}
          />
        </mesh>
        <mesh geometry={revGeometry}>
          <meshBasicMaterial color={solid.color} wireframe transparent opacity={0.08} />
        </mesh>
      </group>
    );
  }

  return null;
};

// ==================== EXPLICIT SURFACE z = f(x, y) ====================

const Surface3DRenderer: React.FC<{ surface: Surface3D; sliderScope: Record<string, number> }> = ({
  surface,
  sliderScope,
}) => {
  const geometry = useMemo(() => {
    try {
      const compiled = compileExpression(surface.expr);
      const [minR, maxR] = surface.range;
      const N = 40;
      const positions: number[] = [];
      const colors: number[] = [];
      const indices: number[] = [];
      const zVals: number[] = [];

      for (let iy = 0; iy <= N; iy++) {
        for (let ix = 0; ix <= N; ix++) {
          const x = minR + ((maxR - minR) * ix) / N;
          const y = minR + ((maxR - minR) * iy) / N;
          const rawZ = compiled.eval({ ...sliderScope, x, y });
          const z = Number.isFinite(rawZ) ? Math.max(-8, Math.min(8, rawZ)) : 0;
          zVals.push(z);
          const [sx, sy, sz] = mathToScene([x, y, z]);
          positions.push(sx, sy, sz);
        }
      }

      const zMin = Math.min(...zVals);
      const zMax = Math.max(...zVals);
      const span = Math.max(0.01, zMax - zMin);
      const col = new THREE.Color();
      for (const z of zVals) {
        const t = (z - zMin) / span;
        col.setHSL(0.62 - t * 0.48, 0.72, 0.5);
        colors.push(col.r, col.g, col.b);
      }

      for (let iy = 0; iy < N; iy++) {
        for (let ix = 0; ix < N; ix++) {
          const a = iy * (N + 1) + ix;
          const b = a + 1;
          const c = a + (N + 1);
          const d = c + 1;
          indices.push(a, b, d, a, d, c);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    } catch {
      return null;
    }
  }, [surface.expr, surface.range, sliderScope]);

  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          vertexColors
          transparent
          opacity={surface.opacity}
          side={THREE.DoubleSide}
          roughness={0.45}
        />
      </mesh>
      {surface.wireframe && (
        <mesh geometry={geometry}>
          <meshBasicMaterial color="#0F1B2D" wireframe transparent opacity={0.14} />
        </mesh>
      )}
    </group>
  );
};

// ==================== INTERACTIVE 3D->2D POLYHEDRON NET & OXY FUNCTION CURVES ====================

function faceCentroidScene(pts: THREE.Vector3[]): THREE.Vector3 {
  const c = new THREE.Vector3();
  for (const p of pts) c.add(p);
  return c.divideScalar(Math.max(1, pts.length));
}

function makePivotRotation(pivot: THREE.Vector3, axisUnit: THREE.Vector3, angleRad: number): THREE.Matrix4 {
  const t1 = new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z);
  const rot = new THREE.Matrix4().makeRotationAxis(axisUnit, angleRad);
  const t2 = new THREE.Matrix4().makeTranslation(pivot.x, pivot.y, pivot.z);
  return t2.multiply(rot).multiply(t1);
}

const Net3DRenderer: React.FC<{
  net: Net3D;
  poly: Polyhedron3D | undefined;
  ptMap: Map<string, Vec3>;
  unfoldT: number;
  isDark: boolean;
}> = ({ net, poly, ptMap, unfoldT, isDark }) => {
  const unfoldedFaces = useMemo(() => {
    if (!poly || poly.faces.length === 0) return [];
    const facePts = poly.faces.map((f) =>
      f.map((id) => new THREE.Vector3(...mathToScene(ptMap.get(id) ?? [0, 0, 0])))
    );
    // Root face = lowest math Z (largest scene Y smallest)
    let rootIdx = 0;
    let lowestY = Infinity;
    for (let i = 0; i < facePts.length; i++) {
      const avgY = facePts[i].reduce((acc, v) => acc + v.y, 0) / Math.max(1, facePts[i].length);
      if (avgY < lowestY) {
        lowestY = avgY;
        rootIdx = i;
      }
    }

    const visited = new Set<number>([rootIdx]);
    const mats = new Map<number, THREE.Matrix4>([[rootIdx, new THREE.Matrix4()]]);
    const queue: number[] = [rootIdx];

    while (queue.length > 0) {
      const pIdx = queue.shift()!;
      const pIds = poly.faces[pIdx];
      const pPts = facePts[pIdx];
      const pCent = faceCentroidScene(pPts);
      const pMat = mats.get(pIdx)!;

      for (let ei = 0; ei < pIds.length; ei++) {
        const uId = pIds[ei];
        const vId = pIds[(ei + 1) % pIds.length];

        for (let cIdx = 0; cIdx < poly.faces.length; cIdx++) {
          if (visited.has(cIdx)) continue;
          const cIds = poly.faces[cIdx];
          if (!cIds.includes(uId) || !cIds.includes(vId)) continue;

          visited.add(cIdx);
          const pA = new THREE.Vector3(...mathToScene(ptMap.get(uId) ?? [0, 0, 0]));
          const pB = new THREE.Vector3(...mathToScene(ptMap.get(vId) ?? [0, 0, 0]));
          const dir = pB.clone().sub(pA).normalize();
          const mEdge = pA.clone().add(pB).multiplyScalar(0.5);

          // Vector in parent face perpendicular to edge pointing outward from parent centroid
          const toP = pCent.clone().sub(mEdge);
          const inParentFromCent = toP.clone().sub(dir.clone().multiplyScalar(toP.dot(dir)));
          const outwardTarget = inParentFromCent.lengthSq() > 1e-6 ? inParentFromCent.normalize().negate() : new THREE.Vector3(1, 0, 0);

          // Vector in child face perpendicular to edge pointing toward child centroid
          const cCent = faceCentroidScene(facePts[cIdx]);
          const toC = cCent.clone().sub(mEdge);
          const childPerp = toC.clone().sub(dir.clone().multiplyScalar(toC.dot(dir)));
          let theta = 0;
          if (childPerp.lengthSq() > 1e-6) {
            childPerp.normalize();
            const crossVec = new THREE.Vector3().crossVectors(childPerp, outwardTarget);
            theta = Math.atan2(crossVec.dot(dir), childPerp.dot(outwardTarget));
          }

          const localFold = makePivotRotation(pA, dir, unfoldT * theta);
          const cMat = new THREE.Matrix4().multiplyMatrices(pMat, localFold);
          mats.set(cIdx, cMat);
          queue.push(cIdx);
        }
      }
    }

    return facePts.map((pts, idx) => {
      const m = mats.get(idx) ?? new THREE.Matrix4();
      const transformed = pts.map((v) => v.clone().applyMatrix4(m));
      const positions: number[] = [];
      for (let i = 1; i < transformed.length - 1; i++) {
        positions.push(
          transformed[0].x, transformed[0].y, transformed[0].z,
          transformed[i].x, transformed[i].y, transformed[i].z,
          transformed[i + 1].x, transformed[i + 1].y, transformed[i + 1].z
        );
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.computeVertexNormals();
      const loop: Array<[number, number, number]> = transformed.map((v) => [v.x, v.y, v.z]);
      if (loop.length > 0) loop.push(loop[0]);
      return { geo, loop };
    });
  }, [poly, ptMap, unfoldT]);

  useEffect(() => {
    return () => {
      for (const f of unfoldedFaces) f.geo.dispose();
    };
  }, [unfoldedFaces]);

  if (!poly || unfoldedFaces.length === 0) return null;

  return (
    <group>
      {unfoldedFaces.map((f, idx) => (
        <group key={idx}>
          <mesh geometry={f.geo}>
            <meshStandardMaterial
              color={net.color}
              transparent
              opacity={0.34}
              side={THREE.DoubleSide}
              depthWrite={false}
              roughness={0.45}
            />
          </mesh>
          <Line points={f.loop} color={isDark ? '#E2E8F0' : '#0F1B2D'} lineWidth={2.1} />
        </group>
      ))}
    </group>
  );
};

const Curve3DRenderer: React.FC<{ curve: Curve3D; sliderScope: Record<string, number> }> = ({
  curve,
  sliderScope,
}) => {
  const pts = useMemo(() => {
    try {
      const compiled = compileExpression(curve.expr);
      const chunks: Array<Array<[number, number, number]>> = [];
      let cur: Array<[number, number, number]> = [];
      let prevY = 0;
      for (let i = 0; i <= 220; i++) {
        const x = -6 + (12 * i) / 220;
        const y = compiled.eval({ ...sliderScope, x });
        if (!Number.isFinite(y) || Math.abs(y) > 8 || (cur.length > 0 && Math.abs(y - prevY) > 6)) {
          if (cur.length >= 2) chunks.push(cur);
          cur = [];
        } else {
          cur.push(mathToScene([x, y, 0.02]));
          prevY = y;
        }
      }
      if (cur.length >= 2) chunks.push(cur);
      return chunks;
    } catch {
      return [];
    }
  }, [curve.expr, sliderScope]);

  return (
    <group>
      {pts.map((seg, idx) => (
        <Line key={idx} points={seg} color={curve.color} lineWidth={2.5} />
      ))}
    </group>
  );
};

// ==================== LIVE 3D CONSTRUCTION RUBBER-BAND & GHOST SOLID PREVIEW ====================

function computeSquareBase3D(p1: Vec3, p2: Vec3): { p3: Vec3; p4: Vec3; side: number } {
  const u = sub3(p2, p1);
  const side = Math.max(0.5, len3(u));
  let perp: Vec3 = [-u[1], u[0], 0];
  if (len3(perp) < 1e-4) perp = [0, side, 0];
  else perp = scale3(normalize3(perp), side);
  return {
    p3: [p2[0] + perp[0], p2[1] + perp[1], p2[2]],
    p4: [p1[0] + perp[0], p1[1] + perp[1], p1[2]],
    side,
  };
}

const ConstructionPreview3D: React.FC<{
  activeTool3D: Tool3D;
  segment3DMode: Segment3DSolidMode;
  pendingIds: string[];
  closedBase3D: string[];
  ptMap: Map<string, Vec3>;
  hoveredPointId: string | null;
  hoverGroundPos: Vec3 | null;
  snapToGrid: boolean;
  isDark: boolean;
  onCloseBase?: () => void;
}> = ({
  activeTool3D,
  segment3DMode,
  pendingIds,
  closedBase3D,
  ptMap,
  hoveredPointId,
  hoverGroundPos,
  snapToGrid,
  isDark,
  onCloseBase,
}) => {
  const isPolyTool =
    activeTool3D === 'pyramid' ||
    activeTool3D === 'prism' ||
    activeTool3D === 'extrudePyramid' ||
    activeTool3D === 'extrudePrism';
  const pendingPts = pendingIds.map((id) => ptMap.get(id)).filter((p): p is Vec3 => Boolean(p));
  const closedBasePts = closedBase3D.map((id) => ptMap.get(id)).filter((p): p is Vec3 => Boolean(p));
  const isSnappingToClose = isPolyTool && closedBasePts.length === 0 && pendingPts.length >= 3 && hoveredPointId === pendingIds[0];

  const closeTargetRingPts = useMemo(() => {
    if (!isPolyTool || closedBasePts.length > 0 || pendingPts.length < 3) return null;
    const anchor = pendingPts[0];
    const r = isSnappingToClose ? 0.5 : 0.38;
    const pts: Array<[number, number, number]> = [];
    for (let i = 0; i <= 24; i++) {
      const t = (i / 24) * Math.PI * 2;
      pts.push(mathToScene([anchor[0] + r * Math.cos(t), anchor[1] + r * Math.sin(t), anchor[2] + 0.025]));
    }
    return pts;
  }, [isPolyTool, closedBasePts.length, pendingPts, isSnappingToClose]);

  const snapBaseFillGeo = useMemo(() => {
    if (!isSnappingToClose || pendingPts.length < 3) return null;
    const verts: number[] = [];
    const p0 = mathToScene(pendingPts[0]);
    for (let i = 1; i + 1 < pendingPts.length; i++) {
      const p1 = mathToScene(pendingPts[i]);
      const p2 = mathToScene(pendingPts[i + 1]);
      verts.push(p0[0], p0[1] + 0.012, p0[2], p1[0], p1[1] + 0.012, p1[2], p2[0], p2[1] + 0.012, p2[2]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return geo;
  }, [isSnappingToClose, pendingPts]);

  useEffect(() => () => snapBaseFillGeo?.dispose(), [snapBaseFillGeo]);

  const groundRingPts = useMemo(() => {
    if (activeTool3D === 'select' || !hoverGroundPos || hoveredPointId) return null;
    const pts: Array<[number, number, number]> = [];
    const r = 0.22;
    for (let i = 0; i <= 20; i++) {
      const t = (i / 20) * Math.PI * 2;
      pts.push(mathToScene([hoverGroundPos[0] + r * Math.cos(t), hoverGroundPos[1] + r * Math.sin(t), 0.015]));
    }
    return pts;
  }, [activeTool3D, hoverGroundPos, hoveredPointId]);

  if (activeTool3D === 'select') return null;

  const targetPos: Vec3 | null = hoveredPointId ? ptMap.get(hoveredPointId) ?? hoverGroundPos : hoverGroundPos;

  const renderToolPreview = () => {
    // 0. GeoGebra 2-Click Tetrahedron & Cube Previews
    if ((activeTool3D === 'tetrahedron' || activeTool3D === 'cube') && pendingPts.length === 1 && targetPos) {
      const p1 = pendingPts[0];
      const p2 = targetPos;
      if (dist3(p1, p2) < 0.08) return null;

      if (activeTool3D === 'tetrahedron') {
        const u = sub3(p2, p1);
        const side = Math.max(0.5, len3(u));
        let perp: Vec3 = [-u[1], u[0], 0];
        if (len3(perp) < 1e-4) perp = [0, 1, 0];
        else perp = normalize3(perp);
        const triH = (side * Math.sqrt(3)) / 2;
        const mid: Vec3 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2];
        const p3: Vec3 = [mid[0] + perp[0] * triH, mid[1] + perp[1] * triH, mid[2]];
        const g = centroid3([p1, p2, p3]);
        const sPos: Vec3 = [g[0], g[1], g[2] + side * Math.sqrt(2 / 3)];
        return (
          <group>
            <Line points={[mathToScene(p1), mathToScene(p2), mathToScene(p3), mathToScene(p1)]} color="#0E9F6E" lineWidth={2.6} />
            <Line points={[mathToScene(sPos), mathToScene(p1)]} color="#E06D1F" lineWidth={2} dashed dashSize={0.18} gapSize={0.11} />
            <Line points={[mathToScene(sPos), mathToScene(p2)]} color="#E06D1F" lineWidth={2} dashed dashSize={0.18} gapSize={0.11} />
            <Line points={[mathToScene(sPos), mathToScene(p3)]} color="#E06D1F" lineWidth={2} dashed dashSize={0.18} gapSize={0.11} />
          </group>
        );
      }

      const { p3, p4, side } = computeSquareBase3D(p1, p2);
      const p1T: Vec3 = [p1[0], p1[1], p1[2] + side];
      const p2T: Vec3 = [p2[0], p2[1], p2[2] + side];
      const p3T: Vec3 = [p3[0], p3[1], p3[2] + side];
      const p4T: Vec3 = [p4[0], p4[1], p4[2] + side];
      return (
        <group>
          <Line points={[mathToScene(p1), mathToScene(p2), mathToScene(p3), mathToScene(p4), mathToScene(p1)]} color="#7C3AED" lineWidth={2.6} />
          <Line points={[mathToScene(p1T), mathToScene(p2T), mathToScene(p3T), mathToScene(p4T), mathToScene(p1T)]} color="#7C3AED" lineWidth={2} dashed dashSize={0.16} gapSize={0.1} />
          <Line points={[mathToScene(p1), mathToScene(p1T)]} color="#7C3AED" lineWidth={1.8} dashed dashSize={0.16} gapSize={0.1} />
          <Line points={[mathToScene(p2), mathToScene(p2T)]} color="#7C3AED" lineWidth={1.8} dashed dashSize={0.16} gapSize={0.1} />
          <Line points={[mathToScene(p3), mathToScene(p3T)]} color="#7C3AED" lineWidth={1.8} dashed dashSize={0.16} gapSize={0.1} />
          <Line points={[mathToScene(p4), mathToScene(p4T)]} color="#7C3AED" lineWidth={1.8} dashed dashSize={0.16} gapSize={0.1} />
        </group>
      );
    }

    // 0b. GeoGebra Cone & Cylinder 2-Click Preview
    if ((activeTool3D === 'cone' || activeTool3D === 'cylinder') && pendingPts.length === 1 && targetPos) {
      const c = pendingPts[0];
      const r = dist3(c, targetPos);
      if (r < 0.08) return null;
      const h = Math.max(2.5, r * 1.5);
      const ringBot: Array<[number, number, number]> = [];
      const ringTop: Array<[number, number, number]> = [];
      for (let i = 0; i <= 36; i++) {
        const t = (i / 36) * Math.PI * 2;
        ringBot.push(mathToScene([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t), c[2]]));
        ringTop.push(mathToScene([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t), c[2] + h]));
      }
      const sPos: Vec3 = [c[0], c[1], c[2] + h];
      return (
        <group>
          <Line points={ringBot} color="#E06D1F" lineWidth={2.4} />
          {activeTool3D === 'cylinder' ? (
            <Line points={ringTop} color="#0891B2" lineWidth={2} dashed dashSize={0.18} gapSize={0.1} />
          ) : (
            <>
              <Line points={[mathToScene(sPos), mathToScene([c[0] + r, c[1], c[2]])]} color="#E06D1F" lineWidth={1.8} dashed dashSize={0.16} gapSize={0.1} />
              <Line points={[mathToScene(sPos), mathToScene([c[0] - r, c[1], c[2]])]} color="#E06D1F" lineWidth={1.8} dashed dashSize={0.16} gapSize={0.1} />
            </>
          )}
        </group>
      );
    }

    // 0c. GeoGebra Pyramid & Prism Multi-Point Polygon Base + Apex Preview
    if (
      activeTool3D === 'pyramid' ||
      activeTool3D === 'prism' ||
      activeTool3D === 'extrudePyramid' ||
      activeTool3D === 'extrudePrism'
    ) {
      if (closedBasePts.length >= 3) {
        const loop = [...closedBasePts.map(mathToScene), mathToScene(closedBasePts[0])];
        const g = centroid3(closedBasePts);
        const target = targetPos ?? [g[0], g[1], g[2] + 3.2];
        const apex: Vec3 = [target[0], target[1], Math.abs(target[2] - g[2]) < 0.25 ? g[2] + 3.2 : target[2]];
        return (
          <group>
            <Line points={loop} color="#E06D1F" lineWidth={3} />
            {activeTool3D === 'pyramid' || activeTool3D === 'extrudePyramid'
              ? closedBasePts.map((bp, idx) => (
                  <Line key={idx} points={[mathToScene(apex), mathToScene(bp)]} color="#E06D1F" lineWidth={2} dashed dashSize={0.16} gapSize={0.1} />
                ))
              : closedBasePts.map((bp, idx) => (
                  <Line
                    key={idx}
                    points={[mathToScene(bp), mathToScene([bp[0], bp[1], bp[2] + 3.2])]}
                    color="#0891B2"
                    lineWidth={2}
                    dashed
                    dashSize={0.16}
                    gapSize={0.1}
                  />
                ))}
          </group>
        );
      }

      if (pendingPts.length >= 1) {
        const polyPts = pendingPts.map(mathToScene);
        if (isSnappingToClose) {
          polyPts.push(mathToScene(pendingPts[0]));
        } else if (targetPos) {
          polyPts.push(mathToScene(targetPos));
        }
        return (
          <group>
            {snapBaseFillGeo && (
              <mesh geometry={snapBaseFillGeo}>
                <meshBasicMaterial color="#0E9F6E" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
              </mesh>
            )}
            {polyPts.length >= 2 && (
              <Line
                points={polyPts}
                color={isSnappingToClose ? '#0E9F6E' : '#E06D1F'}
                lineWidth={isSnappingToClose ? 3.2 : 2.6}
                dashed={!isSnappingToClose}
                dashSize={0.18}
                gapSize={0.1}
              />
            )}
            {closeTargetRingPts && (
              <Line
                points={closeTargetRingPts}
                color="#0E9F6E"
                lineWidth={isSnappingToClose ? 3.2 : 2.2}
              />
            )}
            {pendingPts.length >= 3 && (
              <Label3D
                interactive
                position={mathToScene([pendingPts[0][0], pendingPts[0][1], pendingPts[0][2] + 0.56])}
              >
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onCloseBase?.();
                  }}
                  className={`pointer-events-auto cursor-pointer select-none whitespace-nowrap rounded px-2 py-0.5 text-[10.5px] font-bold text-white shadow-md transition-transform ${
                    isSnappingToClose
                      ? 'scale-110 bg-[#059669] ring-2 ring-emerald-200'
                      : 'bg-[#0E9F6E] hover:bg-[#059669]'
                  }`}
                >
                  {isSnappingToClose ? 'Nhấn để khép đáy ✓' : 'Chạm lại để khép đáy'}
                </button>
              </Label3D>
            )}
          </group>
        );
      }
      return null;
    }

    if (!targetPos || pendingPts.length === 0) return null;

    // 1. Integrated Smart Segment Tool:
    //    - Step 2 (1 point chosen): dashed segment rubber-band with live length
    //    - Step 3 (2 points chosen, segment AB connected!): live 3D ghost Box / Tetrahedron / Pyramid4!
    if (activeTool3D === 'segment') {
      if (pendingPts.length === 1) {
        const p1 = pendingPts[0];
        const d = dist3(p1, targetPos);
        if (d < 0.04) return null;
        const mid: Vec3 = [(p1[0] + targetPos[0]) / 2, (p1[1] + targetPos[1]) / 2, (p1[2] + targetPos[2]) / 2 + 0.22];
        return (
          <group>
            <Line
              points={[mathToScene(p1), mathToScene(targetPos)]}
              color="#0284C7"
              lineWidth={2.8}
              dashed
              dashSize={0.18}
              gapSize={0.11}
            />
            <Label3D position={mathToScene(mid)}>
              <div
                className={`font-math pointer-events-none select-none whitespace-nowrap rounded border px-1.5 py-0.5 text-[10.5px] font-bold shadow-xs ${
                  isDark ? 'border-sky-400 bg-slate-900/95 text-sky-300' : 'border-sky-500 bg-sky-50/95 text-sky-900'
                }`}
              >
                {formatNum(d, 2)}
              </div>
            </Label3D>
          </group>
        );
      }

      if (pendingPts.length >= 2) {
        const [p1, p2] = pendingPts;

        if (segment3DMode === 'box') {
          const u = sub3(p2, p1);
          const sideA = Math.max(0.5, len3(u));
          const perpRaw: Vec3 = [-u[1], u[0], 0];
          const unitV: Vec3 = len3(perpRaw) > 1e-4 ? normalize3(perpRaw) : [0, 1, 0];

          let cPos: Vec3;
          let dPos: Vec3;
          let h: number;
          let sideB: number;

          if (hoveredPointId && !pendingIds.includes(hoveredPointId)) {
            if (Math.abs(targetPos[2] - p1[2]) >= 0.25) {
              const sq = computeSquareBase3D(p1, p2);
              cPos = sq.p3;
              dPos = sq.p4;
              sideB = sq.side;
              h = Math.abs(targetPos[2] - p1[2]);
            } else if (dist3(targetPos, p2) <= dist3(targetPos, p1)) {
              cPos = targetPos;
              dPos = [p1[0] + (targetPos[0] - p2[0]), p1[1] + (targetPos[1] - p2[1]), p1[2]];
              sideB = Math.max(0.5, dist3(p2, cPos));
              h = Math.max(1.5, Math.round(((sideA + sideB) / 2) * 2) / 2);
            } else {
              dPos = targetPos;
              cPos = [p2[0] + (targetPos[0] - p1[0]), p2[1] + (targetPos[1] - p1[1]), p2[2]];
              sideB = Math.max(0.5, dist3(p1, dPos));
              h = Math.max(1.5, Math.round(((sideA + sideB) / 2) * 2) / 2);
            }
          } else {
            const dx = targetPos[0] - p2[0];
            const dy = targetPos[1] - p2[1];
            const bRaw = dx * unitV[0] + dy * unitV[1];
            const bSign = bRaw >= 0 ? 1 : -1;
            const bMag =
              Math.abs(bRaw) < 0.45
                ? Math.max(1.5, sideA)
                : snapToGrid
                ? Math.round(Math.abs(bRaw) * 2) / 2
                : Number(Math.abs(bRaw).toFixed(2));
            const bSigned = bSign * bMag;
            sideB = bMag;
            cPos = [p2[0] + unitV[0] * bSigned, p2[1] + unitV[1] * bSigned, p2[2]];
            dPos = [p1[0] + unitV[0] * bSigned, p1[1] + unitV[1] * bSigned, p1[2]];
            h = Math.max(1.5, Math.round(((sideA + sideB) / 2) * 2) / 2);
          }

          const p1Top: Vec3 = [p1[0], p1[1], p1[2] + h];
          const p2Top: Vec3 = [p2[0], p2[1], p2[2] + h];
          const cTop: Vec3 = [cPos[0], cPos[1], cPos[2] + h];
          const dTop: Vec3 = [dPos[0], dPos[1], dPos[2] + h];
          const topCenter = centroid3([p1Top, p2Top, cTop, dTop]);

          return (
            <group>
              <Line
                points={[mathToScene(p1), mathToScene(p2), mathToScene(cPos), mathToScene(dPos), mathToScene(p1)]}
                color="#7C3AED"
                lineWidth={2.8}
              />
              <Line
                points={[mathToScene(p1Top), mathToScene(p2Top), mathToScene(cTop), mathToScene(dTop), mathToScene(p1Top)]}
                color="#7C3AED"
                lineWidth={2.2}
                dashed
                dashSize={0.18}
                gapSize={0.11}
              />
              <Line points={[mathToScene(p1), mathToScene(p1Top)]} color="#7C3AED" lineWidth={1.9} dashed dashSize={0.16} gapSize={0.1} />
              <Line points={[mathToScene(p2), mathToScene(p2Top)]} color="#7C3AED" lineWidth={1.9} dashed dashSize={0.16} gapSize={0.1} />
              <Line points={[mathToScene(cPos), mathToScene(cTop)]} color="#7C3AED" lineWidth={1.9} dashed dashSize={0.16} gapSize={0.1} />
              <Line points={[mathToScene(dPos), mathToScene(dTop)]} color="#7C3AED" lineWidth={1.9} dashed dashSize={0.16} gapSize={0.1} />
              <Label3D position={mathToScene([topCenter[0], topCenter[1], topCenter[2] + 0.25])}>
                <div
                  className={`font-math pointer-events-none select-none whitespace-nowrap rounded border px-1.5 py-0.5 text-[10.5px] font-bold shadow-xs ${
                    isDark
                      ? 'border-violet-400 bg-slate-900/95 text-violet-300'
                      : 'border-violet-500 bg-violet-50/95 text-violet-900'
                  }`}
                >
                  Hình hộp {formatNum(sideA, 1)} × {formatNum(sideB, 1)} × {formatNum(h, 1)}
                </div>
              </Label3D>
            </group>
          );
        }

        if (segment3DMode === 'tetrahedron') {
          const p3 = targetPos;
          let n = cross3(sub3(p2, p1), sub3(p3, p1));
          if (n[2] < 0) n = scale3(n, -1);
          const unitN = len3(n) > 1e-4 ? normalize3(n) : ([0, 0, 1] as Vec3);
          const avgEdge = (dist3(p1, p2) + dist3(p2, p3) + dist3(p3, p1)) / 3;
          const h = Math.max(2, Math.round(avgEdge * Math.sqrt(2 / 3) * 2) / 2);
          const g = centroid3([p1, p2, p3]);
          const sPos: Vec3 = [g[0] + unitN[0] * h, g[1] + unitN[1] * h, Math.max(1.5, g[2] + unitN[2] * h)];
          return (
            <group>
              <Line points={[mathToScene(p1), mathToScene(p2), mathToScene(p3), mathToScene(p1)]} color="#0E9F6E" lineWidth={2.8} />
              <Line points={[mathToScene(sPos), mathToScene(p1)]} color="#E06D1F" lineWidth={2.1} dashed dashSize={0.18} gapSize={0.11} />
              <Line points={[mathToScene(sPos), mathToScene(p2)]} color="#E06D1F" lineWidth={2.1} dashed dashSize={0.18} gapSize={0.11} />
              <Line points={[mathToScene(sPos), mathToScene(p3)]} color="#E06D1F" lineWidth={2.1} dashed dashSize={0.18} gapSize={0.11} />
              <mesh position={mathToScene(sPos)}>
                <sphereGeometry args={[0.11, 14, 14]} />
                <meshBasicMaterial color="#E06D1F" transparent opacity={0.85} />
              </mesh>
              <Label3D position={mathToScene([sPos[0], sPos[1], sPos[2] + 0.28])}>
                <span className="pointer-events-none select-none rounded bg-[#E06D1F] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                  Chóp tứ diện S
                </span>
              </Label3D>
            </group>
          );
        }

        if (segment3DMode === 'pyramid4') {
          const { p3, p4, side } = computeSquareBase3D(p1, p2);
          const defaultH = Math.max(2.5, Math.round(side * 1.15 * 2) / 2);
          const sPos: Vec3 = [
            targetPos[0],
            targetPos[1],
            Math.abs(targetPos[2] - p1[2]) < 0.25 ? p1[2] + defaultH : targetPos[2],
          ];
          return (
            <group>
              <Line points={[mathToScene(p1), mathToScene(p2), mathToScene(p3), mathToScene(p4), mathToScene(p1)]} color="#1D5CE5" lineWidth={2.8} />
              <Line points={[mathToScene(sPos), mathToScene(p1)]} color="#E06D1F" lineWidth={2.2} dashed dashSize={0.18} gapSize={0.11} />
              <Line points={[mathToScene(sPos), mathToScene(p2)]} color="#E06D1F" lineWidth={2.2} dashed dashSize={0.18} gapSize={0.11} />
              <Line points={[mathToScene(sPos), mathToScene(p3)]} color="#E06D1F" lineWidth={2.2} dashed dashSize={0.18} gapSize={0.11} />
              <Line points={[mathToScene(sPos), mathToScene(p4)]} color="#E06D1F" lineWidth={2.2} dashed dashSize={0.18} gapSize={0.11} />
              <mesh position={mathToScene(sPos)}>
                <sphereGeometry args={[0.12, 14, 14]} />
                <meshBasicMaterial color="#E06D1F" />
              </mesh>
              <Label3D position={mathToScene([sPos[0], sPos[1], sPos[2] + 0.3])}>
                <span className="pointer-events-none select-none rounded bg-[#E06D1F] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                  Đỉnh S
                </span>
              </Label3D>
            </group>
          );
        }
      }
      return null;
    }

    // 2. Other 2-point linear tools: line, vector, midpoint, ratio, distance
    if (
      activeTool3D === 'line' ||
      activeTool3D === 'vector' ||
      activeTool3D === 'midpoint' ||
      activeTool3D === 'ratio' ||
      activeTool3D === 'distance'
    ) {
      const p1 = pendingPts[0];
      const d = dist3(p1, targetPos);
      if (d < 0.04) return null;
      const mid: Vec3 = [(p1[0] + targetPos[0]) / 2, (p1[1] + targetPos[1]) / 2, (p1[2] + targetPos[2]) / 2 + 0.22];
      return (
        <group>
          <Line
            points={[mathToScene(p1), mathToScene(targetPos)]}
            color="#0284C7"
            lineWidth={2.8}
            dashed
            dashSize={0.18}
            gapSize={0.11}
          />
          <Label3D position={mathToScene(mid)}>
            <div
              className={`font-math pointer-events-none select-none whitespace-nowrap rounded border px-1.5 py-0.5 text-[10.5px] font-bold shadow-xs ${
                isDark ? 'border-sky-400 bg-slate-900/95 text-sky-300' : 'border-sky-500 bg-sky-50/95 text-sky-900'
              }`}
            >
              {formatNum(d, 2)}
            </div>
          </Label3D>
        </group>
      );
    }

    // 3. 3-point plane / cross-section / angle tools
    if (activeTool3D === 'plane3p' || activeTool3D === 'crossSection' || activeTool3D === 'angle') {
      if (pendingPts.length === 1) {
        return (
          <Line
            points={[mathToScene(pendingPts[0]), mathToScene(targetPos)]}
            color="#0284C7"
            lineWidth={2.5}
            dashed
            dashSize={0.18}
            gapSize={0.11}
          />
        );
      }
      if (pendingPts.length >= 2) {
        const [p1, p2] = pendingPts;
        return (
          <Line
            points={[mathToScene(p1), mathToScene(p2), mathToScene(targetPos), mathToScene(p1)]}
            color="#0284C7"
            lineWidth={2.5}
            dashed
            dashSize={0.18}
            gapSize={0.11}
          />
        );
      }
    }

    return null;
  };

  return (
    <group>
      {/* Subtle ground target cursor ring when hovering empty ground plane in any construction tool */}
      {groundRingPts && hoverGroundPos && (
        <group>
          <Line points={groundRingPts} color="#0284C7" lineWidth={1.8} />
          <mesh position={mathToScene([hoverGroundPos[0], hoverGroundPos[1], 0.015])}>
            <sphereGeometry args={[0.055, 12, 12]} />
            <meshBasicMaterial color="#0284C7" />
          </mesh>
        </group>
      )}
      {renderToolPreview()}
    </group>
  );
};

// ==================== MAIN 3D SCENE CONTENT WITH PRESS-AND-HOLD Z ELEVATION ====================

const Scene3DContent: React.FC<{ controlsRef: React.RefObject<OrbitControlsImpl | null> }> = ({ controlsRef }) => {
  const { camera, size, gl } = useThree();
  const scene3d = useGeometryStore((s) => s.scene3d);
  const sliders = useGeometryStore((s) => s.sliders);
  const view = useGeometryStore((s) => s.view);
  const selection = useGeometryStore((s) => s.selection);
  const pendingIds = useGeometryStore((s) => s.pendingIds);
  const closedBase3D = useGeometryStore((s) => s.closedBase3D);
  const activeTool3D = useGeometryStore((s) => s.activeTool3D);
  const segment3DMode = useGeometryStore((s) => s.segment3DMode);
  const handlePoint3DClick = useGeometryStore((s) => s.handlePoint3DClick);
  const handleGround3DConstructionClick = useGeometryStore((s) => s.handleGround3DConstructionClick);
  const createNetForPolyhedron = useGeometryStore((s) => s.createNetForPolyhedron);
  const extrudePolyhedronToSolid = useGeometryStore((s) => s.extrudePolyhedronToSolid);
  const selectItem = useGeometryStore((s) => s.selectItem);
  const addPoint3D = useGeometryStore((s) => s.addPoint3D);
  const updatePoint3DCoords = useGeometryStore((s) => s.updatePoint3DCoords);
  const updatePoints3DZBulk = useGeometryStore((s) => s.updatePoints3DZBulk);
  const pushHistory = useGeometryStore((s) => s.pushHistory);

  const isDark = view.theme === 'dark';

  // Separate hitbox hover vs ground magnetic hover so crossing sphere/ground boundary never flickers!
  const [hitboxHoverPointId, setHitboxHoverPointId] = useState<string | null>(null);
  const [magneticHoverPointId, setMagneticHoverPointId] = useState<string | null>(null);
  const hoveredPointId = hitboxHoverPointId ?? magneticHoverPointId;
  const [hoverGroundPos, setHoverGroundPos] = useState<Vec3 | null>(null);

  const isPolygonClosingReady =
    (activeTool3D === 'pyramid' ||
      activeTool3D === 'prism' ||
      activeTool3D === 'extrudePyramid' ||
      activeTool3D === 'extrudePrism') &&
    closedBase3D.length === 0 &&
    pendingIds.length >= 3;

  useEffect(() => {
    setHoverGroundPos(null);
    setMagneticHoverPointId(null);
    setHitboxHoverPointId(null);
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [activeTool3D]);

  // Press-and-hold Z-drag session ref + reactive HUD
  const dragRef = useRef<ZDragSession | null>(null);
  const suppressClickIdRef = useRef<string | null>(null);
  const [zHud, setZHud] = useState<ZDragHud | null>(null);

  const sliderScope = useMemo(
    () => Object.fromEntries(sliders.map((sl) => [sl.name, sl.value])),
    [sliders]
  );

  const ptMap = useMemo(
    () => resolvePoints3D(scene3d.points, scene3d.planes, sliderScope),
    [scene3d.points, scene3d.planes, sliderScope]
  );

  // Window-level pointermove / pointerup for silky 1:1 vertical Z/height elevation on desktop & mobile!
  useEffect(() => {
    const computeUnitsPerPx = (baseX: number, baseY: number, baseZ: number) => {
      const pScene = new THREE.Vector3(...mathToScene([baseX, baseY, baseZ]));
      const dist = Math.max(2, camera.position.distanceTo(pScene));
      const fovDeg = camera instanceof THREE.PerspectiveCamera ? camera.fov : 38;
      const worldHeight = 2 * dist * Math.tan(((fovDeg * Math.PI) / 180) / 2);
      return worldHeight / Math.max(200, size.height);
    };

    const onPointerMove = (e: PointerEvent) => {
      const session = dragRef.current;
      if (!session || e.pointerId !== session.pointerId) return;

      const dx = e.clientX - session.startClientX;
      const dy = session.startClientY - e.clientY; // positive when dragging UP

      // Activate Z-drag right away if dragging vertically!
      if (!session.activated && Math.abs(dy) >= 10 && Math.abs(dy) >= Math.abs(dx) * 1.1) {
        if (session.timerId !== null) {
          window.clearTimeout(session.timerId);
          session.timerId = null;
        }
        session.activated = true;
        session.moved = true;
        suppressClickIdRef.current = session.pointId;
        if (session.mode === 'adjust') pushHistory();
        if (controlsRef.current) controlsRef.current.enabled = false;
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate(16); } catch { /* ignore */ }
        }
        setZHud({
          pointId: session.pointId,
          x: session.baseX,
          y: session.baseY,
          z: session.baseZ,
          displayVal: session.hudLabel === 'h' ? Math.abs(session.baseZ - session.floorZ) : session.baseZ,
          label: session.hudLabel,
          mode: session.mode,
        });
      }

      if (!session.activated) return;

      if (Math.abs(dy) >= 4 || session.moved) {
        session.moved = true;
        const unitsPerPx = computeUnitsPerPx(session.baseX, session.baseY, session.baseZ);
        const snap = useGeometryStore.getState().view.snapToGrid;
        const deltaRaw = dy * unitsPerPx;
        const delta = snap ? Math.round(deltaRaw * 2) / 2 : Number(deltaRaw.toFixed(2));
        const nextAnchorZ = Math.max(-12, Math.min(12, Number((session.baseZ + delta).toFixed(2))));

        if (session.targetPoints.length > 1) {
          // Elevate entire top face of Box 3D in unison while keeping min height >= 0.5!
          const clampedZ = Math.max(session.floorZ + 0.5, nextAnchorZ);
          const actualDelta = clampedZ - session.baseZ;
          updatePoints3DZBulk(
            session.targetPoints.map((tp) => ({
              id: tp.id,
              z: Number((tp.baseZ + actualDelta).toFixed(2)),
            }))
          );
          setZHud({
            pointId: session.pointId,
            x: session.baseX,
            y: session.baseY,
            z: clampedZ,
            displayVal: Number(Math.abs(clampedZ - session.floorZ).toFixed(2)),
            label: 'h',
            mode: session.mode,
          });
        } else {
          updatePoint3DCoords(session.pointId, [session.baseX, session.baseY, nextAnchorZ]);
          setZHud({
            pointId: session.pointId,
            x: session.baseX,
            y: session.baseY,
            z: nextAnchorZ,
            displayVal: nextAnchorZ,
            label: 'z',
            mode: session.mode,
          });
        }
      }
    };

    const finishDrag = (e: PointerEvent) => {
      const session = dragRef.current;
      if (!session || e.pointerId !== session.pointerId) return;
      if (session.timerId !== null) {
        window.clearTimeout(session.timerId);
      }

      // If this was a quick tap/click on an existing point (in 'select' mode) without Z-dragging, select it reliably now!
      if (session.mode === 'adjust' && !session.activated && !session.moved) {
        suppressClickIdRef.current = session.pointId;
        handlePoint3DClick(session.pointId, e.shiftKey || e.ctrlKey || e.metaKey);
        setTimeout(() => {
          if (suppressClickIdRef.current === session.pointId) {
            suppressClickIdRef.current = null;
          }
        }, 120);
      } else if (session.activated || session.moved) {
        suppressClickIdRef.current = session.pointId;
        setTimeout(() => {
          if (suppressClickIdRef.current === session.pointId) {
            suppressClickIdRef.current = null;
          }
        }, 100);
      }

      dragRef.current = null;
      setZHud(null);
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', finishDrag);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
    };
  }, [camera, size.height, controlsRef, updatePoint3DCoords, updatePoints3DZBulk, pushHistory, handlePoint3DClick]);

  // Attach optional hold-and-drag Z / height elevation right after creating a point, apex S, or box top face!
  const attachCreateZDrag = (
    target: Construction3DDragTarget,
    nativeEvent: PointerEvent,
    immediateActivate: boolean
  ) => {
    const curPts = useGeometryStore.getState().scene3d.points;
    const targetPoints: Array<{ id: string; baseZ: number }> = [];
    for (const id of target.pointIds) {
      const pt = curPts.find((p) => p.id === id);
      if (pt && !pt.computed) {
        targetPoints.push({ id: pt.id, baseZ: pt.z });
      }
    }
    if (targetPoints.length === 0) return;
    if (controlsRef.current) controlsRef.current.enabled = false;

    const primaryId = targetPoints[0].id;
    const session: ZDragSession = {
      pointId: primaryId,
      targetPoints,
      baseX: target.anchor[0],
      baseY: target.anchor[1],
      baseZ: target.anchor[2],
      floorZ: target.baseZ,
      hudLabel: target.label,
      startClientX: nativeEvent.clientX,
      startClientY: nativeEvent.clientY,
      pointerId: nativeEvent.pointerId,
      mode: 'create',
      activated: immediateActivate,
      moved: false,
      timerId: null,
    };

    const hudInitial: ZDragHud = {
      pointId: primaryId,
      x: target.anchor[0],
      y: target.anchor[1],
      z: target.anchor[2],
      displayVal: target.label === 'h' ? Math.abs(target.anchor[2] - target.baseZ) : target.anchor[2],
      label: target.label,
      mode: 'create',
    };

    if (immediateActivate) {
      setZHud(hudInitial);
    } else {
      session.timerId = window.setTimeout(() => {
        if (dragRef.current !== session) return;
        session.activated = true;
        setZHud(hudInitial);
      }, 200);
    }

    dragRef.current = session;
  };

  const snapGroundVal = (v: number) => (view.snapToGrid ? Math.round(v * 2) / 2 : Number(v.toFixed(2)));

  // Screen-space + raw un-snapped world magnetic picker (prioritizes closing vertex A cleanly!)
  const findMagneticPointFromEvent = (nativeEvent: PointerEvent, rawGroundPos?: Vec3 | null): string | null => {
    const rect = gl.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const pointerX = nativeEvent.clientX - rect.left;
    const pointerY = nativeEvent.clientY - rect.top;
    const candidates = scene3d.points
      .filter((p) => p.visible)
      .map((p) => {
        const worldPos = ptMap.get(p.id) ?? [p.x, p.y, p.z];
        const projected = new THREE.Vector3(...mathToScene(worldPos)).project(camera);
        return {
          id: p.id,
          screenX: ((projected.x + 1) / 2) * rect.width,
          screenY: ((-projected.y + 1) / 2) * rect.height,
          worldPos,
        };
      });

    return pickMagneticPoint3D({
      candidates,
      pointerX,
      pointerY,
      rawGroundPos,
      priorityCloseId: isPolygonClosingReady ? pendingIds[0] : null,
      isTouch: nativeEvent.pointerType === 'touch',
    });
  };

  // Ground plane interaction for both 'point' tool and all 3D construction tools!
  const handleGroundPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (activeTool3D === 'select') return;
    if (e.nativeEvent.button !== 0 && e.nativeEvent.pointerType === 'mouse') return;
    e.stopPropagation();

    const rawMath = sceneToMath([e.point.x, e.point.y, e.point.z]);
    const rawGroundPos: Vec3 = [rawMath[0], rawMath[1], 0];

    if (activeTool3D === 'point') {
      const x = snapGroundVal(rawMath[0]);
      const y = snapGroundVal(rawMath[1]);
      const newId = addPoint3D(x, y, 0);
      selectItem({ domain: '3d', type: 'point', id: newId }, false);
      attachCreateZDrag({ pointIds: [newId], anchor: [x, y, 0], baseZ: 0, label: 'z' }, e.nativeEvent, true);
      return;
    }

    // Check magnetic point capture BEFORE snapping to grid so clicks on/near point A never drift to a neighbor cell!
    const nearId = hitboxHoverPointId ?? findMagneticPointFromEvent(e.nativeEvent, rawGroundPos);
    if (nearId) {
      const dragTarget = handlePoint3DClick(nearId, false);
      if (dragTarget) attachCreateZDrag(dragTarget, e.nativeEvent, false);
      return;
    }

    // Otherwise snap to grid and auto-create vertex on ground plane
    const x = snapGroundVal(rawMath[0]);
    const y = snapGroundVal(rawMath[1]);
    const dragTarget = handleGround3DConstructionClick([x, y, 0]);
    if (dragTarget) {
      attachCreateZDrag(dragTarget, e.nativeEvent, false);
    }
  };

  const handleGroundPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (activeTool3D === 'select') return;
    const rawMath = sceneToMath([e.point.x, e.point.y, e.point.z]);
    const rawGroundPos: Vec3 = [rawMath[0], rawMath[1], 0];
    const magId = findMagneticPointFromEvent(e.nativeEvent, rawGroundPos);
    setMagneticHoverPointId(magId);
    if (!hitboxHoverPointId) {
      document.body.style.cursor = magId ? 'pointer' : 'crosshair';
    }
    setHoverGroundPos([snapGroundVal(rawMath[0]), snapGroundVal(rawMath[1]), 0]);
  };

  // Point hitbox pointerdown: instant response in construction tools, or tap/hold-Z in select/point tools!
  const handlePointHitboxPointerDown = (
    e: ThreeEvent<PointerEvent>,
    pointId: string,
    pos: Vec3,
    isComputed: boolean
  ) => {
    if (e.nativeEvent.button !== 0 && e.nativeEvent.pointerType === 'mouse') return;
    e.stopPropagation();

    // Construction tools: register click immediately on pointerdown so it NEVER drops!
    if (activeTool3D !== 'select' && activeTool3D !== 'point') {
      suppressClickIdRef.current = pointId;
      setTimeout(() => {
        if (suppressClickIdRef.current === pointId) {
          suppressClickIdRef.current = null;
        }
      }, 150);
      const dragTarget = handlePoint3DClick(
        pointId,
        e.nativeEvent.shiftKey || e.nativeEvent.ctrlKey || e.nativeEvent.metaKey
      );
      if (dragTarget) {
        attachCreateZDrag(dragTarget, e.nativeEvent, false);
      }
      return;
    }

    // Select or Point tool: support both instant tap selection (on pointerup) and press-and-hold Z elevation!
    if (controlsRef.current) controlsRef.current.enabled = false;

    const session: ZDragSession = {
      pointId,
      targetPoints: [{ id: pointId, baseZ: pos[2] }],
      baseX: pos[0],
      baseY: pos[1],
      baseZ: pos[2],
      floorZ: 0,
      hudLabel: 'z',
      startClientX: e.nativeEvent.clientX,
      startClientY: e.nativeEvent.clientY,
      pointerId: e.nativeEvent.pointerId,
      mode: 'adjust',
      activated: false,
      moved: false,
      timerId: null,
    };

    if (!isComputed) {
      session.timerId = window.setTimeout(() => {
        if (dragRef.current !== session) return;
        session.activated = true;
        session.moved = true;
        suppressClickIdRef.current = pointId;
        pushHistory();
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { navigator.vibrate(18); } catch { /* ignore */ }
        }
        setZHud({
          pointId,
          x: pos[0],
          y: pos[1],
          z: pos[2],
          displayVal: pos[2],
          label: 'z',
          mode: 'adjust',
        });
      }, 220);
    }

    dragRef.current = session;
  };

  const resolveLinear3D = (refId: string): { point: Vec3; dir: Vec3 } | null => {
    const seg = scene3d.segments.find((s) => s.id === refId);
    if (seg) {
      const a = ptMap.get(seg.p1Id);
      const b = ptMap.get(seg.p2Id);
      if (a && b) return { point: a, dir: sub3(b, a) };
    }
    const line = scene3d.lines.find((l) => l.id === refId);
    if (line) {
      if (line.p1Id && line.p2Id) {
        const a = ptMap.get(line.p1Id);
        const b = ptMap.get(line.p2Id);
        if (a && b) return { point: a, dir: sub3(b, a) };
      }
      return { point: line.point, dir: line.dir };
    }
    return null;
  };

  return (
    <>
      <color attach="background" args={[isDark ? '#0D131F' : '#FAFBFD']} />
      <ambientLight intensity={isDark ? 0.72 : 0.85} />
      <directionalLight position={[10, 15, 10]} intensity={0.75} />
      <directionalLight position={[-8, -6, -8]} intensity={0.25} />

      <CameraRig controlsRef={controlsRef} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        target={[0, 0.3, 0]}
        minDistance={2}
        maxDistance={45}
      />

      <AxesOxyz
        isDark={isDark}
        showAxes={view.showAxes}
        showGrid={view.showGrid}
        showOxyPlane={view.showOxyPlane3D}
        showLabels={view.showLabels}
      />

      {/* Interactive horizontal ground plane for placing points & clicking directly in construction tools */}
      {activeTool3D !== 'select' && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          onPointerDown={handleGroundPointerDown}
          onPointerMove={handleGroundPointerMove}
          onPointerOut={() => {
            setHoverGroundPos(null);
            setMagneticHoverPointId(null);
          }}
        >
          <planeGeometry args={[28, 28]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

      {/* Live rubber-band & 3D ghost solid construction preview */}
      <ConstructionPreview3D
        activeTool3D={activeTool3D}
        segment3DMode={segment3DMode}
        pendingIds={pendingIds}
        closedBase3D={closedBase3D}
        ptMap={ptMap}
        hoveredPointId={hoveredPointId}
        hoverGroundPos={hoverGroundPos}
        snapToGrid={view.snapToGrid}
        isDark={isDark}
        onCloseBase={() => {
          if (pendingIds[0]) {
            handlePoint3DClick(pendingIds[0], false);
          }
        }}
      />

      {/* Active live Z-elevation visual guide rail & ground drop-line */}
      {zHud && <ZElevationGuide hud={zHud} isDark={isDark} />}

      {/* Polyhedra (hidden when an interactive unfolded Net3D is visible for the same polyhedron) */}
      {scene3d.polyhedra.map((poly) => {
        if (!poly.visible) return null;
        const hasVisibleNet = (scene3d.nets ?? []).some((n) => n.visible && n.polyhedronId === poly.id);
        if (hasVisibleNet) return null;
        return (
          <PolyhedronRenderer
            key={poly.id}
            poly={poly}
            ptMap={ptMap}
            autoDashedGlobal={view.autoDashedHiddenEdges}
            globalOpacity={view.globalFaceOpacity}
            isDark={isDark}
            isSelected={selection.some((x) => x.domain === '3d' && x.type === 'polyhedron' && x.id === poly.id)}
            onSelect={(multi) => {
              if (activeTool3D === 'net') {
                createNetForPolyhedron(poly.id);
              } else if (activeTool3D === 'extrudePyramid') {
                extrudePolyhedronToSolid(poly.id, 'pyramid');
              } else if (activeTool3D === 'extrudePrism') {
                extrudePolyhedronToSolid(poly.id, 'prism');
              } else {
                selectItem({ domain: '3d', type: 'polyhedron', id: poly.id }, multi);
              }
            }}
          />
        );
      })}

      {/* Interactive 3D -> 2D Unfolding Nets */}
      {(scene3d.nets ?? []).map((net) => {
        if (!net.visible) return null;
        const poly = scene3d.polyhedra.find((p) => p.id === net.polyhedronId);
        const unfoldT = sliderScope[net.sliderName] ?? 0.72;
        return <Net3DRenderer key={net.id} net={net} poly={poly} ptMap={ptMap} unfoldT={unfoldT} isDark={isDark} />;
      })}

      {/* 2D Function Curves plotted on the 3D Oxy plane */}
      {(scene3d.curves ?? []).map(
        (cv) => cv.visible && <Curve3DRenderer key={cv.id} curve={cv} sliderScope={sliderScope} />
      )}

      {/* Cross Sections */}
      {scene3d.crossSections.map(
        (cs) =>
          cs.visible && (
            <CrossSectionRenderer
              key={cs.id}
              cs={cs}
              poly={scene3d.polyhedra.find((p) => p.id === cs.polyhedronId)}
              planes={scene3d.planes}
              ptMap={ptMap}
              showLabels={view.showLabels}
              isDark={isDark}
            />
          )
      )}

      {/* Planes */}
      {scene3d.planes.map(
        (pl) =>
          pl.visible && (
            <Plane3DRenderer
              key={pl.id}
              plane={pl}
              ptMap={ptMap}
              isSelected={selection.some((x) => x.domain === '3d' && x.type === 'plane' && x.id === pl.id)}
              onSelect={(multi) => selectItem({ domain: '3d', type: 'plane', id: pl.id }, multi)}
            />
          )
      )}

      {/* Solids */}
      {scene3d.solids.map(
        (solid) =>
          solid.visible && (
            <Solid3DRenderer
              key={solid.id}
              solid={solid}
              planes={scene3d.planes}
              ptMap={ptMap}
              sliderScope={sliderScope}
              showLabels={view.showLabels}
            />
          )
      )}

      {/* Explicit Surfaces */}
      {scene3d.surfaces.map(
        (surf) => surf.visible && <Surface3DRenderer key={surf.id} surface={surf} sliderScope={sliderScope} />
      )}

      {/* Segments */}
      {scene3d.segments.map((seg) => {
        if (!seg.visible) return null;
        const p1 = ptMap.get(seg.p1Id);
        const p2 = ptMap.get(seg.p2Id);
        if (!p1 || !p2) return null;
        const mid: Vec3 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2];
        const len = dist3(p1, p2);
        const isSel = selection.some((x) => x.domain === '3d' && x.type === 'segment' && x.id === seg.id);
        const segColor = isSel ? '#1D5CE5' : seg.color === '#0F1B2D' && isDark ? '#E2E8F0' : seg.color;
        return (
          <group key={seg.id}>
            <Line
              points={[mathToScene(p1), mathToScene(p2)]}
              color={segColor}
              lineWidth={isSel ? 3.2 : 2.2}
              dashed={seg.style === 'dashed'}
              dashSize={0.2}
              gapSize={0.13}
              onClick={(e) => {
                e.stopPropagation();
                selectItem({ domain: '3d', type: 'segment', id: seg.id }, e.shiftKey || e.ctrlKey || e.metaKey);
              }}
            />
            {seg.showLength && view.showLabels && (
              <Label3D position={mathToScene([mid[0], mid[1], mid[2] + 0.16])}>
                <span
                  className={`font-math pointer-events-none select-none rounded border px-1 py-0.5 text-[10px] font-semibold shadow-2xs ${
                    isDark ? 'border-slate-700 bg-slate-900/90 text-slate-100' : 'border-slate-300 bg-white/95 text-[#0F1B2D]'
                  }`}
                >
                  {formatNum(len, 2)}
                </span>
              </Label3D>
            )}
          </group>
        );
      })}

      {/* Infinite Lines */}
      {scene3d.lines.map((line) => {
        if (!line.visible) return null;
        let pt = line.point;
        let dir = line.dir;
        if (line.p1Id && line.p2Id) {
          const a = ptMap.get(line.p1Id);
          const b = ptMap.get(line.p2Id);
          if (a && b) {
            pt = a;
            dir = sub3(b, a);
          }
        }
        const nDir = normalize3(dir);
        if (len3(nDir) < 1e-6) return null;
        const pStart = add3(pt, scale3(nDir, -8));
        const pEnd = add3(pt, scale3(nDir, 8));
        const isSel = selection.some((x) => x.domain === '3d' && x.type === 'line' && x.id === line.id);
        return (
          <Line
            key={line.id}
            points={[mathToScene(pStart), mathToScene(pEnd)]}
            color={isSel ? '#1D5CE5' : line.color}
            lineWidth={isSel ? 3 : 2}
            dashed={line.dashed}
            dashSize={0.22}
            gapSize={0.14}
            onClick={(e) => {
              e.stopPropagation();
              selectItem({ domain: '3d', type: 'line', id: line.id }, e.shiftKey || e.ctrlKey || e.metaKey);
            }}
          />
        );
      })}

      {/* Vectors */}
      {scene3d.vectors.map((vec) => {
        if (!vec.visible) return null;
        const orig = vec.originId ? ptMap.get(vec.originId) ?? vec.origin : vec.origin;
        const tip = vec.targetId ? ptMap.get(vec.targetId) ?? add3(orig, vec.dir) : add3(orig, vec.dir);
        return <VectorArrow3D key={vec.id} origin={orig} tip={tip} color={vec.color} label={vec.name} showLabel={view.showLabels} />;
      })}

      {/* Measurements */}
      {scene3d.measurements.map((m) => {
        if (!m.visible) return null;

        if (m.kind === 'distancePP' && m.refs.length >= 2) {
          const a = ptMap.get(m.refs[0]);
          const b = ptMap.get(m.refs[1]);
          if (!a || !b) return null;
          const d = dist3(a, b);
          const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 + 0.2];
          return (
            <group key={m.id}>
              <Line points={[mathToScene(a), mathToScene(b)]} color={m.color} lineWidth={2.2} dashed dashSize={0.16} gapSize={0.1} />
              {view.showLabels && (
                <Label3D position={mathToScene(mid)}>
                  <div className="font-math pointer-events-none select-none whitespace-nowrap rounded border border-violet-400 bg-white/95 px-1.5 py-0.5 text-[11px] font-semibold text-violet-800 shadow-xs">
                    {m.name} = {formatNum(d, 2)}
                  </div>
                </Label3D>
              )}
            </group>
          );
        }

        if (m.kind === 'distancePPlane' && m.refs.length >= 2) {
          const p = ptMap.get(m.refs[0]);
          const pl = scene3d.planes.find((x) => x.id === m.refs[1]);
          if (!p || !pl) return null;
          const eq = resolvePlaneEq(pl, ptMap);
          if (!eq) return null;
          const h = footPointOnPlane(p, eq);
          const d = distPointToPlane(p, eq);
          const mid: Vec3 = [(p[0] + h[0]) / 2 - 0.35, (p[1] + h[1]) / 2 + 1.05, (p[2] + h[2]) / 2 + 0.45];
          return (
            <group key={m.id}>
              <Line points={[mathToScene(p), mathToScene(h)]} color={m.color} lineWidth={2.6} dashed dashSize={0.14} gapSize={0.1} />
              <mesh position={mathToScene(h)}>
                <sphereGeometry args={[0.075, 14, 14]} />
                <meshStandardMaterial color={m.color} />
              </mesh>
              {view.showLabels && (
                <Label3D position={mathToScene(mid)}>
                  <div className="font-math pointer-events-none select-none whitespace-nowrap rounded border border-violet-400 bg-white/95 px-1.5 py-0.5 text-[11px] font-semibold text-violet-800 shadow-xs">
                    {m.name} = {formatNum(d, 2)}
                  </div>
                </Label3D>
              )}
            </group>
          );
        }

        if (m.kind === 'distanceSkew' && m.refs.length >= 2) {
          const l1 = resolveLinear3D(m.refs[0]);
          const l2 = resolveLinear3D(m.refs[1]);
          if (!l1 || !l2) return null;
          const res = skewLinesDistance(l1.point, l1.dir, l2.point, l2.dir);
          const mid: Vec3 = [
            (res.h1[0] + res.h2[0]) / 2,
            (res.h1[1] + res.h2[1]) / 2,
            (res.h1[2] + res.h2[2]) / 2 + 0.2,
          ];
          return (
            <group key={m.id}>
              <Line points={[mathToScene(res.h1), mathToScene(res.h2)]} color={m.color} lineWidth={3} dashed dashSize={0.15} gapSize={0.1} />
              <mesh position={mathToScene(res.h1)}>
                <sphereGeometry args={[0.08, 14, 14]} />
                <meshStandardMaterial color={m.color} />
              </mesh>
              <mesh position={mathToScene(res.h2)}>
                <sphereGeometry args={[0.08, 14, 14]} />
                <meshStandardMaterial color={m.color} />
              </mesh>
              {view.showLabels && (
                <Label3D position={mathToScene(mid)}>
                  <div className="font-math pointer-events-none select-none whitespace-nowrap rounded border border-violet-400 bg-white/95 px-1.5 py-0.5 text-[11px] font-semibold text-violet-800 shadow-xs">
                    {m.name} = {formatNum(res.distance, 2)}
                  </div>
                </Label3D>
              )}
            </group>
          );
        }

        if (m.kind === 'angle3P' && m.refs.length === 3) {
          const a = ptMap.get(m.refs[0]);
          const b = ptMap.get(m.refs[1]);
          const c = ptMap.get(m.refs[2]);
          if (!a || !b || !c) return null;
          const deg = angle3Points3DDeg(a, b, c);
          const u = normalize3(sub3(a, b));
          const v = normalize3(sub3(c, b));
          const r = 0.6;
          const arcPts: Array<[number, number, number]> = [];
          const steps = 18;
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const dir = normalize3(add3(scale3(u, 1 - t), scale3(v, t)));
            arcPts.push(mathToScene(add3(b, scale3(dir, r))));
          }
          const labelPos = add3(b, scale3(normalize3(add3(u, v)), r + 0.35));
          return (
            <group key={m.id}>
              <Line points={arcPts} color={m.color} lineWidth={2.5} />
              {view.showLabels && (
                <Label3D position={mathToScene(labelPos)}>
                  <div className="font-math pointer-events-none select-none whitespace-nowrap rounded border border-amber-500 bg-white/95 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 shadow-xs">
                    {formatNum(deg, 1)}°
                  </div>
                </Label3D>
              )}
            </group>
          );
        }

        if (m.kind === 'angleLL' && m.refs.length >= 2) {
          const l1 = resolveLinear3D(m.refs[0]);
          const l2 = resolveLinear3D(m.refs[1]);
          if (!l1 || !l2) return null;
          const deg = angleLineLineDeg(l1.dir, l2.dir);
          const mid = centroid3([l1.point, l2.point]);
          return view.showLabels ? (
            <Label3D key={m.id} position={mathToScene([mid[0], mid[1], mid[2] + 0.35])}>
              <div className="font-math pointer-events-none select-none whitespace-nowrap rounded border border-amber-500 bg-white/95 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                {m.name}: {formatNum(deg, 1)}°
              </div>
            </Label3D>
          ) : null;
        }

        if (m.kind === 'angleLPlane' && m.refs.length >= 2) {
          const l1 = resolveLinear3D(m.refs[0]);
          const pl = scene3d.planes.find((p) => p.id === m.refs[1]);
          if (!l1 || !pl) return null;
          const eq = resolvePlaneEq(pl, ptMap);
          if (!eq) return null;
          const deg = angleLinePlaneDeg(l1.dir, eq);
          return view.showLabels ? (
            <Label3D key={m.id} position={mathToScene([l1.point[0], l1.point[1], l1.point[2] + 0.5])}>
              <div className="font-math pointer-events-none select-none whitespace-nowrap rounded border border-amber-500 bg-white/95 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                Góc đường–mặt: {formatNum(deg, 1)}°
              </div>
            </Label3D>
          ) : null;
        }

        if (m.kind === 'anglePlanePlane' && m.refs.length >= 2) {
          const p1 = scene3d.planes.find((p) => p.id === m.refs[0]);
          const p2 = scene3d.planes.find((p) => p.id === m.refs[1]);
          if (!p1 || !p2) return null;
          const eq1 = resolvePlaneEq(p1, ptMap);
          const eq2 = resolvePlaneEq(p2, ptMap);
          if (!eq1 || !eq2) return null;
          const deg = anglePlanePlaneDeg(eq1, eq2);
          return view.showLabels ? (
            <Label3D key={m.id} position={mathToScene([0, 0, 2.5])}>
              <div className="font-math pointer-events-none select-none whitespace-nowrap rounded border border-amber-500 bg-white/95 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
                {m.name} = {formatNum(deg, 1)}°
              </div>
            </Label3D>
          ) : null;
        }

        return null;
      })}

      {/* 3D Points with vivid hover glow, instant construction clicking & press-and-hold Z elevation */}
      {scene3d.points.map((pt) => {
        if (!pt.visible) return null;
        const pos = ptMap.get(pt.id) ?? [pt.x, pt.y, pt.z];
        const scenePos = mathToScene(pos);
        const isSel = selection.some((x) => x.domain === '3d' && x.type === 'point' && x.id === pt.id);
        const isPending = pendingIds.includes(pt.id);
        const isDraggingZ = zHud?.pointId === pt.id;
        const isHover = hoveredPointId === pt.id;
        const isCloseTarget = isPolygonClosingReady && pt.id === pendingIds[0];
        return (
          <group key={pt.id}>
            {/* Full Oxyz coordinate drop-lines when Oxyz axes are visible and point is hovered/selected/dragged */}
            {view.showAxes && (view.showCoordProjections ?? true) && (isSel || isHover || isDraggingZ) ? (
              <>
                {Math.abs(pos[2]) > 0.05 && (
                  <Line
                    points={[mathToScene([pos[0], pos[1], 0]), scenePos]}
                    color="#2563EB"
                    lineWidth={isHover ? 1.8 : 1.4}
                    dashed
                    dashSize={0.14}
                    gapSize={0.09}
                    transparent
                    opacity={0.78}
                  />
                )}
                {Math.abs(pos[1]) > 0.05 && (
                  <Line
                    points={[mathToScene([pos[0], pos[1], 0]), mathToScene([pos[0], 0, 0])]}
                    color="#16A34A"
                    lineWidth={1.3}
                    dashed
                    dashSize={0.14}
                    gapSize={0.09}
                    transparent
                    opacity={0.7}
                  />
                )}
                {Math.abs(pos[0]) > 0.05 && (
                  <Line
                    points={[mathToScene([pos[0], pos[1], 0]), mathToScene([0, pos[1], 0])]}
                    color="#DC2626"
                    lineWidth={1.3}
                    dashed
                    dashSize={0.14}
                    gapSize={0.09}
                    transparent
                    opacity={0.7}
                  />
                )}
                {Math.abs(pos[2]) > 0.05 && (Math.abs(pos[0]) > 0.05 || Math.abs(pos[1]) > 0.05) && (
                  <Line
                    points={[scenePos, mathToScene([0, 0, pos[2]])]}
                    color="#2563EB"
                    lineWidth={1.2}
                    dashed
                    dashSize={0.14}
                    gapSize={0.09}
                    transparent
                    opacity={0.58}
                  />
                )}
              </>
            ) : (
              (isSel || isHover) &&
              !isDraggingZ &&
              Math.abs(pos[2]) > 0.05 && (
                <Line
                  points={[mathToScene([pos[0], pos[1], 0]), scenePos]}
                  color={isHover ? '#0284C7' : '#1D5CE5'}
                  lineWidth={isHover ? 1.7 : 1.3}
                  dashed
                  dashSize={0.14}
                  gapSize={0.1}
                  transparent
                  opacity={isHover ? 0.75 : 0.55}
                />
              )
            )}

            <group position={scenePos}>
              {/* Generous invisible hit sphere for effortless finger & mouse picking */}
              <mesh
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHitboxHoverPointId(pt.id);
                  document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                  setHitboxHoverPointId((cur) => (cur === pt.id ? null : cur));
                  document.body.style.cursor = 'auto';
                }}
                onPointerDown={(e) => handlePointHitboxPointerDown(e, pt.id, pos, Boolean(pt.computed))}
                onClick={(e) => {
                  e.stopPropagation();
                  // All construction tools already register immediately on pointerDown (no 150ms hold race!)
                  if (activeTool3D !== 'select' && activeTool3D !== 'point') return;
                  if (suppressClickIdRef.current === pt.id) return;
                  handlePoint3DClick(pt.id, e.shiftKey || e.ctrlKey || e.metaKey);
                }}
              >
                <sphereGeometry args={[isCloseTarget ? 0.52 : 0.36, 14, 14]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>

              {/* Visible core point sphere (scales up & brightens on hover or close-base target) */}
              <mesh>
                <sphereGeometry
                  args={[
                    isDraggingZ
                      ? 0.145
                      : isCloseTarget && isHover
                      ? 0.165
                      : isCloseTarget
                      ? 0.14
                      : isHover
                      ? 0.14
                      : isSel || isPending
                      ? 0.125
                      : 0.095,
                    18,
                    18,
                  ]}
                />
                <meshStandardMaterial
                  color={
                    isDraggingZ
                      ? '#E06D1F'
                      : isCloseTarget
                      ? '#0E9F6E'
                      : isPending
                      ? '#E06D1F'
                      : isHover
                      ? '#0284C7'
                      : isSel
                      ? '#1D5CE5'
                      : pt.color
                  }
                  emissive={isCloseTarget ? '#0E9F6E' : isHover ? '#0284C7' : isPending ? '#E06D1F' : '#000000'}
                  emissiveIntensity={isCloseTarget && isHover ? 0.75 : isCloseTarget ? 0.45 : isHover ? 0.55 : isPending ? 0.35 : 0}
                />
              </mesh>

              {/* Vivid multi-layer outer glow halo when hovered, selected, pending, close-target, or dragging Z */}
              {(isHover || isSel || isPending || isDraggingZ || isCloseTarget) && (
                <>
                  <mesh>
                    <sphereGeometry args={[isDraggingZ || isHover || isCloseTarget ? 0.25 : 0.19, 16, 16]} />
                    <meshBasicMaterial
                      color={isCloseTarget ? '#10B981' : isDraggingZ || isPending ? '#E06D1F' : isHover ? '#38BDF8' : '#1D5CE5'}
                      transparent
                      opacity={isCloseTarget && isHover ? 0.48 : isHover ? 0.42 : isDraggingZ || isCloseTarget ? 0.32 : 0.24}
                      depthWrite={false}
                    />
                  </mesh>
                  {(isHover || isCloseTarget) && (
                    <mesh>
                      <sphereGeometry args={[isCloseTarget ? 0.35 : 0.31, 16, 16]} />
                      <meshBasicMaterial color={isCloseTarget ? '#0E9F6E' : '#0EA5E9'} transparent opacity={isHover ? 0.24 : 0.14} depthWrite={false} />
                    </mesh>
                  )}
                </>
              )}

              {view.showLabels && pt.showLabel && (
                <Label3D position={[0.16, 0.24, 0]}>
                  <span
                    className={`pointer-events-none select-none whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-bold transition-transform ${
                      isDraggingZ || isPending
                        ? 'scale-110 bg-[#E06D1F] text-white ring-2 ring-amber-300 shadow-sm'
                        : isHover
                        ? 'scale-110 bg-[#0284C7] text-white ring-2 ring-sky-300 shadow-sm'
                        : isSel
                        ? 'bg-[#1D5CE5] text-white'
                        : isDark
                        ? 'bg-slate-900/80 text-slate-100'
                        : 'bg-white/90 text-[#0F1B2D]'
                    }`}
                  >
                    {pt.name}
                    {view.showAxes && (isSel || isHover || isDraggingZ)
                      ? `(${formatNum(pos[0], 1)}; ${formatNum(pos[1], 1)}; ${formatNum(pos[2], 1)})`
                      : ''}
                  </span>
                </Label3D>
              )}
            </group>
          </group>
        );
      })}

      {view.showAxes && (
        <GizmoHelper alignment="bottom-right" margin={[58, 58]}>
          <GizmoViewport
            axisColors={['#16A34A', '#2563EB', '#DC2626']}
            labels={['y', 'z', 'x']}
            labelColor={isDark ? '#F8FAFC' : '#0F1B2D'}
          />
        </GizmoHelper>
      )}
    </>
  );
};

// ==================== OUTER 3D VIEWPORT WITH MOBILE-FRIENDLY CONTROLS ====================

export const Viewport3D: React.FC = () => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const view = useGeometryStore((s) => s.view);
  const updateView = useGeometryStore((s) => s.updateView);
  const requestCamera = useGeometryStore((s) => s.requestCamera);
  const [compactPanelOpen, setCompactPanelOpen] = useState(false);
  const vp = useViewportProfile();
  const isDark = view.theme === 'dark';

  const camButtons: Array<{ id: CameraPreset3D; label: string }> = [
    { id: 'oxyz', label: '3D' },
    { id: 'top', label: 'Trên' },
    { id: 'front', label: 'Trước' },
    { id: 'side', label: 'Cạnh' },
  ];

  const controlsPanel = (
    <div className={`flex ${vp.isPhoneLandscape ? 'flex-row items-start gap-2' : 'flex-col items-end gap-1.5'}`}>
      {/* Camera Presets */}
      <div
        className={`flex ${vp.isPhoneLandscape ? 'flex-col' : 'flex-row'} items-stretch overflow-hidden rounded-lg border text-xs font-medium shadow-xs ${
          isDark ? 'border-slate-700 bg-slate-900/94 text-slate-200' : 'border-[#DCE3EC] bg-white/96 text-[#0F1B2D]'
        }`}
      >
        {camButtons.map((btn) => (
          <button
            key={btn.id}
            type="button"
            onClick={() => requestCamera(btn.id)}
            className={`px-2.5 py-1.5 text-center transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Toggles & Opacity */}
      <div
        className={`flex flex-col gap-1 rounded-lg border p-2 text-xs shadow-xs ${
          isDark ? 'border-slate-700 bg-slate-900/94 text-slate-200' : 'border-[#DCE3EC] bg-white/96 text-[#0F1B2D]'
        }`}
      >
        <button
          type="button"
          onClick={() => updateView({ showAxes: !view.showAxes })}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-left font-medium transition-colors ${
            view.showAxes
              ? 'bg-[#1D5CE5]/12 text-[#1D5CE5]'
              : isDark
              ? 'text-slate-400 hover:bg-slate-800'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Axis3D className="h-3.5 w-3.5" />
          <span>Trục tọa độ Oxyz</span>
        </button>

        <button
          type="button"
          onClick={() => updateView({ autoDashedHiddenEdges: !view.autoDashedHiddenEdges })}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-left font-medium transition-colors ${
            view.autoDashedHiddenEdges
              ? 'bg-[#1D5CE5]/12 text-[#1D5CE5]'
              : isDark
              ? 'text-slate-400 hover:bg-slate-800'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Nét đứt cạnh khuất</span>
        </button>

        <button
          type="button"
          onClick={() => updateView({ showOxyPlane3D: !view.showOxyPlane3D })}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-left font-medium transition-colors ${
            view.showOxyPlane3D
              ? 'bg-[#0E9F6E]/12 text-[#0E9F6E]'
              : isDark
              ? 'text-slate-400 hover:bg-slate-800'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Mặt phẳng đáy</span>
        </button>

        <button
          type="button"
          onClick={() => updateView({ showCoordProjections: !(view.showCoordProjections ?? true) })}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-left font-medium transition-colors ${
            (view.showCoordProjections ?? true)
              ? 'bg-[#0284C7]/12 text-[#0284C7]'
              : isDark
              ? 'text-slate-400 hover:bg-slate-800'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Crosshair className="h-3.5 w-3.5" />
          <span>Đường gióng tọa độ</span>
        </button>

        <div className="flex flex-col gap-1 px-1 pt-0.5">
          <div className="flex items-center justify-between text-[11px] opacity-80">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              Độ mờ khối
            </span>
            <span className="font-math">{Math.round(view.globalFaceOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.04}
            max={0.6}
            step={0.02}
            value={view.globalFaceOpacity}
            onChange={(e) => updateView({ globalFaceOpacity: parseFloat(e.target.value) })}
            className="math-slider w-32"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative isolate z-0 h-full w-full touch-none select-none overflow-hidden">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [7.6, 6.2, 8.8], fov: 38, near: 0.1, far: 200 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <Scene3DContent controlsRef={controlsRef} />
      </Canvas>

      {/* Desktop: Always expanded; Compact (Portrait & Landscape Phone!): Collapsible pill so 3D canvas stays unobstructed! */}
      {!vp.isCompact ? (
        <div className="pointer-events-auto absolute top-3 right-3 flex flex-col items-end gap-1.5">
          {controlsPanel}
        </div>
      ) : (
        <div
          className="pointer-events-auto absolute top-2 right-2 flex flex-col items-end gap-1.5"
          style={{ right: 'max(0.5rem, env(safe-area-inset-right))' }}
        >
          <button
            type="button"
            onClick={() => setCompactPanelOpen((o) => !o)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-xs ${
              isDark
                ? 'border-slate-700 bg-slate-900/92 text-slate-200'
                : 'border-[#DCE3EC] bg-white/95 text-[#0F1B2D]'
            }`}
          >
            {compactPanelOpen ? <X className="h-3.5 w-3.5" /> : <SlidersHorizontal className="h-3.5 w-3.5" />}
            <span>Hiển thị</span>
          </button>
          {compactPanelOpen && controlsPanel}
        </div>
      )}
    </div>
  );
};
