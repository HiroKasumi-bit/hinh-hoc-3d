export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export type ViewMode = '2d' | '3d' | 'split';
export type ThemeMode = 'light' | 'dark';

export type Tool2D =
  | 'select'
  | 'point'
  | 'segment'
  | 'line'
  | 'vector'
  | 'circle'
  | 'polygon'
  | 'midpoint'
  | 'perpendicular'
  | 'angle'
  | 'distance';

export type Tool3D =
  | 'select'
  | 'point'
  | 'segment'
  | 'line'
  | 'vector'
  | 'plane3p'
  | 'midpoint'
  | 'ratio'
  | 'footPlane'
  | 'crossSection'
  | 'distance'
  | 'angle';

export interface ParamSlider {
  id: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  playing: boolean;
}

// ==================== 2D OBJECTS ====================

export interface Point2DComputed {
  kind:
    | 'midpoint'
    | 'ratio'
    | 'centroid'
    | 'orthocenter'
    | 'circumcenter'
    | 'incenter'
    | 'footLine';
  refs: string[];
  ratio?: number;
}

export interface Point2D {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  visible: boolean;
  showLabel: boolean;
  computed?: Point2DComputed;
}

export interface Segment2D {
  id: string;
  name: string;
  p1Id: string;
  p2Id: string;
  color: string;
  dashed?: boolean;
  visible: boolean;
  showLength?: boolean;
}

export interface Line2D {
  id: string;
  name: string;
  /** ax + by + c = 0 */
  a: number;
  b: number;
  c: number;
  p1Id?: string;
  p2Id?: string;
  /** Perpendicular to lineId through pointId */
  perpToLineId?: string;
  throughPointId?: string;
  color: string;
  dashed?: boolean;
  visible: boolean;
}

export interface Vector2D {
  id: string;
  name: string;
  originId?: string;
  targetId?: string;
  origin: Vec2;
  dx: number;
  dy: number;
  color: string;
  visible: boolean;
}

export interface Circle2D {
  id: string;
  name: string;
  centerId?: string;
  center: Vec2;
  radius: number;
  radiusPointId?: string;
  color: string;
  fillOpacity: number;
  visible: boolean;
}

export interface Conic2D {
  id: string;
  name: string;
  conicType: 'ellipse' | 'hyperbola' | 'parabola';
  h: number;
  k: number;
  a: number;
  b: number;
  /** For parabola y^2 = 2px */
  p?: number;
  color: string;
  showFoci: boolean;
  visible: boolean;
}

export interface Polygon2D {
  id: string;
  name: string;
  pointIds: string[];
  color: string;
  fillOpacity: number;
  visible: boolean;
  showArea?: boolean;
}

export interface Function2D {
  id: string;
  name: string;
  expr: string;
  color: string;
  visible: boolean;
  showExtrema: boolean;
  showAsymptotes: boolean;
  showRoots: boolean;
  integral?: {
    enabled: boolean;
    a: number;
    b: number;
    revolve3D?: boolean;
    otherFuncId?: string;
  };
}

export interface Inequality2D {
  id: string;
  name: string;
  /** ax + by <op> c */
  a: number;
  b: number;
  c: number;
  op: '<=' | '<' | '>=' | '>';
  color: string;
  visible: boolean;
}

export interface Measure2D {
  id: string;
  name: string;
  kind: 'angle' | 'distance';
  refs: string[];
  color: string;
  visible: boolean;
}

// ==================== 3D OBJECTS (Vietnamese Oxyz: Z is UP) ====================

export interface Point3DComputed {
  kind:
    | 'midpoint'
    | 'ratio'
    | 'centroid'
    | 'footPlane'
    | 'footLine'
    | 'reflectPlane'
    | 'intersectLinePlane';
  refs: string[];
  ratio?: number;
}

export interface Point3D {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  exprCoords?: [string, string, string];
  color: string;
  visible: boolean;
  showLabel: boolean;
  computed?: Point3DComputed;
}

export interface Segment3D {
  id: string;
  name: string;
  p1Id: string;
  p2Id: string;
  color: string;
  style: 'auto' | 'solid' | 'dashed';
  visible: boolean;
  showLength?: boolean;
}

export interface Line3D {
  id: string;
  name: string;
  point: Vec3;
  dir: Vec3;
  p1Id?: string;
  p2Id?: string;
  color: string;
  dashed?: boolean;
  visible: boolean;
}

export interface Vector3D {
  id: string;
  name: string;
  originId?: string;
  targetId?: string;
  origin: Vec3;
  dir: Vec3;
  color: string;
  visible: boolean;
}

export interface Plane3D {
  id: string;
  name: string;
  /** ax + by + cz + d = 0 */
  a: number;
  b: number;
  c: number;
  d: number;
  pointIds?: [string, string, string];
  color: string;
  opacity: number;
  showNormal: boolean;
  visible: boolean;
  size: number;
  center?: Vec3;
}

export interface Polyhedron3D {
  id: string;
  name: string;
  kind: 'pyramid' | 'prism' | 'box' | 'tetrahedron' | 'custom';
  vertexIds: string[];
  /** Outward-oriented counter-clockwise faces (each entry is vertexId list) */
  faces: string[][];
  color: string;
  faceOpacity: number;
  visible: boolean;
  autoDashed: boolean;
}

export interface Solid3D {
  id: string;
  name: string;
  kind: 'sphere' | 'cone' | 'cylinder' | 'revolution';
  center: Vec3;
  radius: number;
  height?: number;
  funcExpr?: string;
  domain?: [number, number];
  color: string;
  opacity: number;
  showAxes: boolean;
  visible: boolean;
}

export interface Surface3D {
  id: string;
  name: string;
  expr: string;
  range: [number, number];
  color: string;
  opacity: number;
  wireframe: boolean;
  visible: boolean;
}

export interface CrossSection3D {
  id: string;
  name: string;
  polyhedronId: string;
  planeId?: string;
  pointIds?: [string, string, string];
  color: string;
  opacity: number;
  visible: boolean;
}

export interface Measurement3D {
  id: string;
  name: string;
  kind:
    | 'distancePP'
    | 'distancePPlane'
    | 'distancePLine'
    | 'distanceSkew'
    | 'angleLL'
    | 'angleLPlane'
    | 'anglePlanePlane'
    | 'angle3P';
  refs: string[];
  color: string;
  visible: boolean;
}

export type CameraPreset3D = 'oxyz' | 'top' | 'front' | 'side' | 'iso';

export interface Scene2DState {
  points: Point2D[];
  segments: Segment2D[];
  lines: Line2D[];
  vectors: Vector2D[];
  circles: Circle2D[];
  conics: Conic2D[];
  polygons: Polygon2D[];
  functions: Function2D[];
  inequalities: Inequality2D[];
  measures: Measure2D[];
}

export interface Scene3DState {
  points: Point3D[];
  segments: Segment3D[];
  lines: Line3D[];
  vectors: Vector3D[];
  planes: Plane3D[];
  polyhedra: Polyhedron3D[];
  solids: Solid3D[];
  surfaces: Surface3D[];
  crossSections: CrossSection3D[];
  measurements: Measurement3D[];
}

export interface SceneSnapshot {
  sliders: ParamSlider[];
  scene2d: Scene2DState;
  scene3d: Scene3DState;
}

export interface ViewSettings {
  showAxes: boolean;
  showGrid: boolean;
  showLabels: boolean;
  snapToGrid: boolean;
  autoDashedHiddenEdges: boolean;
  globalFaceOpacity: number;
  showOxyPlane3D: boolean;
  theme: ThemeMode;
}

export interface SelectedItem {
  domain: '2d' | '3d';
  type:
    | 'point'
    | 'segment'
    | 'line'
    | 'vector'
    | 'circle'
    | 'conic'
    | 'polygon'
    | 'function'
    | 'inequality'
    | 'plane'
    | 'polyhedron'
    | 'solid'
    | 'surface'
    | 'crossSection'
    | 'measurement';
  id: string;
}
