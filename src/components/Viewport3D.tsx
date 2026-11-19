import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { GizmoHelper, GizmoViewport, Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Eye, Layers, Sparkles } from 'lucide-react';
import { useGeometryStore } from '../store/useGeometryStore';
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
  dist3,
  distPointToPlane,
  footPointOnPlane,
  intersectSpherePlane,
  len3,
  mathToScene,
  normalize3,
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
  Plane3D,
  Polyhedron3D,
  Solid3D,
  Surface3D,
  Vec3,
} from '../types/geometry';

/** Keep Drei Html labels strictly below modals (z-50) by capping zIndexRange to [10, 0] */
const Label3D: React.FC<{ position: [number, number, number]; children: React.ReactNode }> = ({
  position,
  children,
}) => (
  <Html position={position} center zIndexRange={[10, 0]}>
    {children}
  </Html>
);

// ==================== CAMERA CONTROLLER & PNG EXPORT BRIDGE ====================

const CameraRig: React.FC<{ controlsRef: React.RefObject<OrbitControlsImpl | null> }> = ({ controlsRef }) => {
  const { camera, gl, scene } = useThree();
  const cameraRequest = useGeometryStore((s) => s.cameraRequest);
  const scene3d = useGeometryStore((s) => s.scene3d);
  const sliders = useGeometryStore((s) => s.sliders);

  useEffect(() => {
    if (!cameraRequest) return;
    const ctrl = controlsRef.current;

    // Auto-compute bounding center & radius of active 3D geometry so every preset frames with clean margins
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

    let centerMath: Vec3 = [1.0, 1.0, 1.2];
    let radius = 3.2;
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
    // Standard Vietnamese Oxyz view: Ox forward-left, Oy right, Oz vertically up
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

// ==================== VIETNAMESE OXYZ AXES & OXY GRID ====================

const AxesOxyz: React.FC<{ isDark: boolean; showAxes: boolean; showGrid: boolean; showOxyPlane: boolean; showLabels: boolean }> = ({
  isDark,
  showAxes,
  showGrid,
  showOxyPlane,
  showLabels,
}) => {
  const axisLen = 6.5;
  const gridLines = useMemo(() => {
    const segs: Array<[number, number, number]> = [];
    const extent = 6;
    for (let i = -extent; i <= extent; i++) {
      segs.push(mathToScene([i, -extent, 0]), mathToScene([i, extent, 0]));
      segs.push(mathToScene([-extent, i, 0]), mathToScene([extent, i, 0]));
    }
    return segs;
  }, []);

  const gridColor = isDark ? '#334155' : '#D4DCE6';
  const oxyFill = isDark ? '#1E293B' : '#E2E8F0';
  const tickColor = isDark ? '#94A3B8' : '#64748B';

  return (
    <group>
      {showOxyPlane && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.004, 0]}>
          <planeGeometry args={[12, 12]} />
          <meshBasicMaterial color={oxyFill} transparent opacity={isDark ? 0.2 : 0.25} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
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

  // Triangulate polyhedron faces into one clean BufferGeometry
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

  // Compute edges with live camera position
  const camMathPos: Vec3 = sceneToMath([camera.position.x, camera.position.y, camera.position.z]);
  const edges = useMemo(() => {
    return computePolyhedronEdgeVisibility(
      { ...poly, autoDashed: effectiveAutoDashed },
      ptMap,
      camMathPos
    );
    // hiddenMask triggers clean re-evaluation ONLY when visibility mask actually flips!
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

// ==================== CROSS-SECTION POLYGON (Thiết diện Lớp 11!) ====================

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
  // Place section badge near the highest-y vertex offset slightly outward so it never covers vertex A
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

// ==================== SOLIDS OF REVOLUTION (Nón, Trụ, Cầu, Khối tròn xoay Tích phân!) ====================

const Solid3DRenderer: React.FC<{
  solid: Solid3D;
  planes: Plane3D[];
  ptMap: Map<string, Vec3>;
  sliderScope: Record<string, number>;
  showLabels: boolean;
}> = ({ solid, planes, ptMap, sliderScope, showLabels }) => {
  const centerScene = mathToScene(solid.center);

  // Equator & meridian rings for spheres/cones/cylinders
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

  // Revolution solid around math Ox (= scene Z axis!)
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
      // LatheGeometry rotates around +Y_three; rotating +90° around X_three aligns +Y_three with +Z_three (= math +Ox!)
      geo.rotateX(Math.PI / 2);
      return geo;
    } catch {
      return null;
    }
  }, [solid.kind, solid.funcExpr, solid.domain, sliderScope]);

  useEffect(() => () => revGeometry?.dispose(), [revGeometry]);

  // Sphere-Plane automatic intersection circles!
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
          // Place intersection circle badge on outer rim so it doesn't overlap I, H, or d(I, (P))
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

// ==================== MAIN 3D SCENE CONTENT ====================

const Scene3DContent: React.FC<{ controlsRef: React.RefObject<OrbitControlsImpl | null> }> = ({ controlsRef }) => {
  const scene3d = useGeometryStore((s) => s.scene3d);
  const sliders = useGeometryStore((s) => s.sliders);
  const view = useGeometryStore((s) => s.view);
  const selection = useGeometryStore((s) => s.selection);
  const pendingIds = useGeometryStore((s) => s.pendingIds);
  const activeTool3D = useGeometryStore((s) => s.activeTool3D);
  const handlePoint3DClick = useGeometryStore((s) => s.handlePoint3DClick);
  const selectItem = useGeometryStore((s) => s.selectItem);
  const addPoint3D = useGeometryStore((s) => s.addPoint3D);

  const isDark = view.theme === 'dark';

  const sliderScope = useMemo(
    () => Object.fromEntries(sliders.map((sl) => [sl.name, sl.value])),
    [sliders]
  );

  const ptMap = useMemo(
    () => resolvePoints3D(scene3d.points, scene3d.planes, sliderScope),
    [scene3d.points, scene3d.planes, sliderScope]
  );

  // Helper to resolve segment or line into (point, dir)
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
        target={[1.2, 1.0, 1.2]}
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

      {/* Clickable Oxy plane when placing 3D points directly */}
      {activeTool3D === 'point' && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            const m = sceneToMath([e.point.x, e.point.y, e.point.z]);
            const snap = (v: number) => (view.snapToGrid ? Math.round(v * 2) / 2 : Number(v.toFixed(2)));
            addPoint3D(snap(m[0]), snap(m[1]), 0);
          }}
        >
          <planeGeometry args={[16, 16]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Polyhedra */}
      {scene3d.polyhedra.map(
        (poly) =>
          poly.visible && (
            <PolyhedronRenderer
              key={poly.id}
              poly={poly}
              ptMap={ptMap}
              autoDashedGlobal={view.autoDashedHiddenEdges}
              globalOpacity={view.globalFaceOpacity}
              isDark={isDark}
              isSelected={selection.some((x) => x.domain === '3d' && x.type === 'polyhedron' && x.id === poly.id)}
              onSelect={(multi) => selectItem({ domain: '3d', type: 'polyhedron', id: poly.id }, multi)}
            />
          )
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

      {/* Solids (Sphere, Cone, Cylinder, Revolution) */}
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

      {/* Explicit Surfaces z = f(x, y) */}
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

      {/* 3D Measurements (Distances, Skew Common Perpendicular, Angles!) */}
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

      {/* 3D Points */}
      {scene3d.points.map((pt) => {
        if (!pt.visible) return null;
        const pos = ptMap.get(pt.id) ?? [pt.x, pt.y, pt.z];
        const scenePos = mathToScene(pos);
        const isSel = selection.some((x) => x.domain === '3d' && x.type === 'point' && x.id === pt.id);
        const isPending = pendingIds.includes(pt.id);
        return (
          <group key={pt.id} position={scenePos}>
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                handlePoint3DClick(pt.id, e.shiftKey || e.ctrlKey || e.metaKey);
              }}
            >
              <sphereGeometry args={[isSel || isPending ? 0.13 : 0.095, 18, 18]} />
              <meshStandardMaterial color={isPending ? '#E06D1F' : isSel ? '#1D5CE5' : pt.color} />
            </mesh>
            {(isSel || isPending) && (
              <mesh>
                <sphereGeometry args={[0.19, 16, 16]} />
                <meshBasicMaterial color={isPending ? '#E06D1F' : '#1D5CE5'} transparent opacity={0.25} />
              </mesh>
            )}
            {view.showLabels && pt.showLabel && (
              <Label3D position={[0.14, 0.22, 0]}>
                <span
                  className={`pointer-events-none select-none whitespace-nowrap rounded px-1 text-xs font-bold ${
                    isSel
                      ? 'bg-[#1D5CE5] text-white'
                      : isDark
                      ? 'bg-slate-900/75 text-slate-100'
                      : 'bg-white/80 text-[#0F1B2D]'
                  }`}
                >
                  {pt.name}
                </span>
              </Label3D>
            )}
          </group>
        );
      })}

      <GizmoHelper alignment="bottom-right" margin={[62, 62]}>
        <GizmoViewport
          axisColors={['#16A34A', '#2563EB', '#DC2626']}
          labels={['y', 'z', 'x']}
          labelColor={isDark ? '#F8FAFC' : '#0F1B2D'}
        />
      </GizmoHelper>
    </>
  );
};

// ==================== OUTER 3D VIEWPORT WITH PRECISION OVERLAY CONTROLS ====================

export const Viewport3D: React.FC = () => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const view = useGeometryStore((s) => s.view);
  const updateView = useGeometryStore((s) => s.updateView);
  const requestCamera = useGeometryStore((s) => s.requestCamera);
  const isDark = view.theme === 'dark';

  const camButtons: Array<{ id: CameraPreset3D; label: string }> = [
    { id: 'oxyz', label: 'Oxyz' },
    { id: 'top', label: 'Trên' },
    { id: 'front', label: 'Trước' },
    { id: 'side', label: 'Cạnh' },
  ];

  return (
    <div className="relative isolate z-0 h-full w-full overflow-hidden">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [7.6, 6.4, 8.8], fov: 38, near: 0.1, far: 200 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <Scene3DContent controlsRef={controlsRef} />
      </Canvas>

      {/* Top-right 3D Viewing Studio Controls */}
      <div className="pointer-events-auto absolute top-3 right-3 flex flex-col items-end gap-1.5">
        {/* Camera Presets */}
        <div
          className={`flex items-center overflow-hidden rounded-lg border text-xs font-medium shadow-xs ${
            isDark ? 'border-slate-700 bg-slate-900/90 text-slate-200' : 'border-[#DCE3EC] bg-white/95 text-[#0F1B2D]'
          }`}
        >
          {camButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => requestCamera(btn.id)}
              className={`px-2.5 py-1.5 transition-colors ${
                isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Auto-Dashed Hidden Edges & X-Ray Opacity */}
        <div
          className={`flex flex-col gap-2 rounded-lg border p-2.5 text-xs shadow-xs ${
            isDark ? 'border-slate-700 bg-slate-900/92 text-slate-200' : 'border-[#DCE3EC] bg-white/95 text-[#0F1B2D]'
          }`}
        >
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
            <span>Mặt đáy (Oxy)</span>
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
    </div>
  );
};
