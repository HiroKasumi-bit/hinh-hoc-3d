---
name: vietnamese-thpt-geometry
description: Domain engineering skill for Vietnamese High School (THPT Lớp 10, 11, 12 - GDPT 2018) 2D & 3D Geometry, Oxyz right-handed coordinate conventions, automatic hidden-edge dashed rendering, polyhedron cross-section slicing, and natural Vietnamese math input parsing.
---

# Vietnamese THPT 2D & 3D Geometry Engine Standards

## 1. Right-Handed Vietnamese Oxyz Convention
Vietnamese high school textbooks (SGK Toán 12) ALWAYS draw:
- **$Oz$ pointing vertically UP** (altitude).
- **$Ox$ pointing forward-left** (towards viewer).
- **$Oy$ pointing right**.

When rendering in Three.js (where `+Y` is Up):
```ts
// Right-handed permutation preserving cross products:
// e_x = (0,0,1), e_y = (1,0,0), e_z = (0,1,0) => e_x x e_y = e_z
export const mathToScene = ([x, y, z]: Vec3): [number, number, number] => [y, z, x];
export const sceneToMath = ([sx, sy, sz]: [number, number, number]): Vec3 => [sz, sx, sy];
```
Never confuse Three.js Y-up with math Z-up when displaying coordinates, equations (`ax + by + cz + d = 0`), or vertical heights (`SA ⊥ (ABCD)` means $S = (x_A, y_A, z_A + h)$).

## 2. Textbook Hidden-Edge Dashed Lines ("Nét đứt cạnh khuất")
For any convex polyhedron with consistently outward-oriented faces:
- Compute each face's outward normal $\vec{n}_f$ and centroid $C_f$.
- For camera position $E$, face $f$ is **front-facing** iff $\vec{n}_f \cdot (E - C_f) > 0$.
- An edge shared by faces $f_1, f_2$ is **hidden (nét đứt)** iff BOTH $f_1$ and $f_2$ are back-facing.
- Render edges using Three.js `Line2` (`@react-three/drei` `<Line>`) so `lineWidth > 1` and crisp world-space dashes work reliably on Windows ANGLE/WebGL.

## 3. Polyhedron Cross-Section ("Thiết diện")
To slice a convex polyhedron with plane $(P): \vec{n} \cdot X + d = 0$:
1. Evaluate signed distance $s_i = \vec{n} \cdot V_i + d$ for every vertex $V_i$.
2. For every edge $(V_i, V_j)$:
   - If $|s_i| < \varepsilon$, add $V_i$.
   - If $s_i \cdot s_j < 0$, compute intersection $Q = V_i + \frac{s_i}{s_i - s_j}(V_j - V_i)$.
3. Deduplicate intersection points within $\varepsilon = 10^{-5}$.
4. If $\ge 3$ unique points remain, build an orthonormal basis $(\vec{u}, \vec{v})$ on $(P)$, sort points by $\operatorname{atan2}((Q - C)\cdot\vec{v}, (Q - C)\cdot\vec{u})$ around centroid $C$, and compute polygon area via $\frac{1}{2} \left|\sum (Q_k - C) \times (Q_{k+1} - C)\right|$.

## 4. Curriculum Coverage (GDPT 2018)
- **Lớp 10**: Oxy coordinates, vectors, triangles & 4 centers ($G, H, O, I$), circles, conics (Elip, Hypebol, Parabol), quadratic functions, linear inequalities half-plane shading (miền nghiệm).
- **Lớp 11**: Pyramids ($S.ABC$, $S.ABCD$ with $SA \perp$ base, regular pyramids), prisms (lăng trụ đứng/đều), cubes, midpoints & ratio division ($SM = k \cdot SA$), orthogonal projections, cross-sections (thiết diện), angles (line-line, line-plane, dihedral angle / góc nhị diện), distances ($d(A,(P))$, skew lines $d(a,b)$ with common perpendicular).
- **Lớp 12**: Oxyz analytic geometry (planes, canonical/parametric lines, spheres, sphere-plane circle intersection), function graphing with extrema/asymptotes/parameter slider $m$, definite integrals & 3D solid of revolution around $Ox$ ($V = \pi \int_a^b f(x)^2 dx$), solids of revolution (Nón, Trụ, Cầu).
