"""Tests for the A* router and geometry helpers."""
from common import Rect, polyline_length, seg_hits_rect, segs_cross, snap
from route import choose_sides, route_edge


def hits(points, obstacles):
    return any(seg_hits_rect(a, b, o) for a, b in zip(points, points[1:]) for o in obstacles)


def test_straight_route_without_obstacles():
    r = route_edge(Rect(0, 0, 120, 60), Rect(300, 0, 120, 60), [])
    assert r.ok and r.points[0] == (120, 30) and r.points[-1] == (300, 30) and len(r.points) == 2


def test_route_goes_around_blocking_block():
    src, dst, wall = Rect(0, 0, 120, 60), Rect(400, 0, 120, 60), Rect(200, -100, 120, 260)
    r = route_edge(src, dst, [wall])
    assert r.ok and not hits(r.points, [wall])
    assert all(a[0] == b[0] or a[1] == b[1] for a, b in zip(r.points, r.points[1:]))  # orthogonal


def test_route_below_target_uses_vertical_sides():
    assert choose_sides(Rect(0, 0, 120, 60), Rect(10, 200, 120, 60)) == ("S", "N")


def test_parallel_edges_get_different_ports():
    a, b = Rect(0, 0, 120, 100), Rect(300, 0, 120, 100)
    r1, r2 = route_edge(a, b, [], src_offset=0), route_edge(a, b, [], src_offset=20)
    assert r1.points[0] != r2.points[0]


def test_geometry_helpers():
    assert snap(175) == 180 and snap(185) == 190 and snap(184) == 180  # halves round up, not to even
    assert segs_cross((0, 5), (10, 5), (5, 0), (5, 10))
    assert not segs_cross((0, 5), (10, 5), (10, 0), (10, 10))  # touching is not crossing
    assert polyline_length([(0, 0), (3, 0), (3, 4)]) == 7
