"""Small orthogonal A* router.

Used by build_diagram.py for edges that ELK did not route: new edges when the
existing diagram is pinned (so manual edits survive). It avoids all obstacle
rectangles, prefers few bends, and works on the diagram grid.
"""
from __future__ import annotations

import heapq
import math
from dataclasses import dataclass

from common import Point, Rect, snap

SIDE_VEC = {"E": (1, 0), "W": (-1, 0), "S": (0, 1), "N": (0, -1)}
DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1)]


@dataclass
class Route:
    points: list[Point]  # full polyline, first/last point sit on the block borders
    exit: tuple[float, float]  # exitX/exitY fractions on the source block
    entry: tuple[float, float]  # entryX/entryY fractions on the target block
    ok: bool = True  # False if A* failed and a naive path was used


def choose_sides(src: Rect, dst: Rect) -> tuple[str, str]:
    """Pick (exit side, entry side) from the relative placement of two blocks."""
    if dst.x >= src.right:
        return "E", "W"
    if dst.right <= src.x:
        return "W", "E"
    if dst.y >= src.bottom:
        return "S", "N"
    return "N", "S"


def port_point(r: Rect, side: str, offset: float = 0, grid: int = 10) -> Point:
    """A grid-aligned point on one side of r, `offset` px away from the side's center."""
    if side in ("E", "W"):
        y = snap(r.y + r.h / 2 + offset, grid)
        y = min(max(y, snap(r.y, grid) + grid), snap(r.bottom, grid) - grid)
        return (r.right if side == "E" else r.x, float(y))
    x = snap(r.x + r.w / 2 + offset, grid)
    x = min(max(x, snap(r.x, grid) + grid), snap(r.right, grid) - grid)
    return (float(x), r.bottom if side == "S" else r.y)


def _inflate(r: Rect, m: float) -> Rect:
    return Rect(r.x - m, r.y - m, r.w + 2 * m, r.h + 2 * m)


def _compress(pts: list[Point]) -> list[Point]:
    out: list[Point] = []
    for p in pts:
        if out and out[-1] == p:
            continue
        if len(out) >= 2:
            (ax, ay), (bx, by) = out[-2], out[-1]
            if (ax == bx == p[0]) or (ay == by == p[1]):
                out[-1] = p
                continue
        out.append(p)
    return out


def route_edge(src: Rect, dst: Rect, obstacles: list[Rect], grid: int = 10, margin: int = 10,
               src_offset: float = 0, dst_offset: float = 0, max_expansions: int = 300_000,
               avoid: list[list[Point]] | None = None) -> Route:
    """Route an orthogonal edge from src to dst around `obstacles` (src and dst are avoided too).

    `avoid` are polylines of existing edges; running along them costs extra so edges do not overlap.
    """
    s_side, d_side = choose_sides(src, dst)
    p0, p1 = port_point(src, s_side, src_offset, grid), port_point(dst, d_side, dst_offset, grid)
    sv, dv = SIDE_VEC[s_side], SIDE_VEC[d_side]
    start = (snap(p0[0] + sv[0] * 2 * grid, grid), snap(p0[1] + sv[1] * 2 * grid, grid))
    goal = (snap(p1[0] + dv[0] * 2 * grid, grid), snap(p1[1] + dv[1] * 2 * grid, grid))
    exit_f = (round((p0[0] - src.x) / src.w, 4), round((p0[1] - src.y) / src.h, 4))
    entry_f = (round((p1[0] - dst.x) / dst.w, 4), round((p1[1] - dst.y) / dst.h, 4))

    blocks = [_inflate(r, margin) for r in [*obstacles, src, dst]]
    xs = [v for r in blocks for v in (r.x, r.right)] + [start[0], goal[0]]
    ys = [v for r in blocks for v in (r.y, r.bottom)] + [start[1], goal[1]]
    ox, oy = snap(min(xs), grid) - 6 * grid, snap(min(ys), grid) - 6 * grid
    nx, ny = int((max(xs) - ox) / grid) + 7, int((max(ys) - oy) / grid) + 7

    blocked: set[tuple[int, int]] = set()
    for r in blocks:
        for ix in range(max(0, int(math.floor((r.x - ox) / grid))), min(nx, int(math.ceil((r.right - ox) / grid)) + 1)):
            for iy in range(max(0, int(math.floor((r.y - oy) / grid))), min(ny, int(math.ceil((r.bottom - oy) / grid)) + 1)):
                if r.x < ox + ix * grid < r.right and r.y < oy + iy * grid < r.bottom:
                    blocked.add((ix, iy))
    crowded: set[tuple[int, int]] = set()
    for poly in avoid or []:
        for (ax, ay), (bx, by) in zip(poly, poly[1:]):
            if ax != bx and ay != by:
                continue
            steps = max(int(abs(bx - ax) / grid), int(abs(by - ay) / grid))
            for k in range(steps + 1):
                x, y = ax + (bx - ax) * k / max(steps, 1), ay + (by - ay) * k / max(steps, 1)
                crowded.add((int(round((x - ox) / grid)), int(round((y - oy) / grid))))
    s_cell = (int((start[0] - ox) / grid), int((start[1] - oy) / grid))
    g_cell = (int((goal[0] - ox) / grid), int((goal[1] - oy) / grid))
    blocked.discard(s_cell)
    blocked.discard(g_cell)

    start_dir = DIRS.index(sv)
    open_heap: list[tuple[float, float, tuple[int, int], int]] = [(0.0, 0.0, s_cell, start_dir)]
    best: dict[tuple[tuple[int, int], int], float] = {(s_cell, start_dir): 0.0}
    came: dict[tuple[tuple[int, int], int], tuple[tuple[int, int], int] | None] = {(s_cell, start_dir): None}
    found: tuple[tuple[int, int], int] | None = None
    expansions = 0
    while open_heap and expansions < max_expansions:
        _, g, cell, d = heapq.heappop(open_heap)
        if g > best.get((cell, d), math.inf):
            continue
        if cell == g_cell:
            found = (cell, d)
            break
        expansions += 1
        for nd, (dx, dy) in enumerate(DIRS):
            if (dx, dy) == (-DIRS[d][0], -DIRS[d][1]):
                continue
            nxt = (cell[0] + dx, cell[1] + dy)
            if not (0 <= nxt[0] < nx and 0 <= nxt[1] < ny) or nxt in blocked:
                continue
            ng = g + 1 + (0 if nd == d else 6) + (5 if nxt in crowded else 0)
            if ng < best.get((nxt, nd), math.inf):
                best[(nxt, nd)] = ng
                came[(nxt, nd)] = (cell, d)
                h = abs(nxt[0] - g_cell[0]) + abs(nxt[1] - g_cell[1])
                heapq.heappush(open_heap, (ng + h, ng, nxt, nd))

    if found is None:
        mid = (goal[0], start[1])
        return Route(_compress([p0, start, mid, goal, p1]), exit_f, entry_f, ok=False)
    cells: list[Point] = []
    node: tuple[tuple[int, int], int] | None = found
    while node is not None:
        (cx, cy), _ = node
        cells.append((float(ox + cx * grid), float(oy + cy * grid)))
        node = came[node]
    cells.reverse()
    return Route(_compress([p0, *cells, p1]), exit_f, entry_f)
