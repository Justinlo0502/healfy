#!/usr/bin/env python3
"""Generate an editable .drawio block diagram from a spec file (deterministic layout).

    python build_diagram.py spec.yaml -o system.drawio [--relayout] [--restyle] [--no-lint] [--export png]

* Fresh build: ELK (elkjs via Node) lays out blocks, containers and orthogonal edges.
* Rebuild of an existing file: geometry and style of every cell whose id still exists
  is kept (your manual edits survive); only new blocks/edges are placed, using ELK
  positions for blocks and an A* router for edges. `--relayout` discards all geometry.
* Cells added by hand in draw.io are kept (tracked through <output>.manifest.json).
"""
from __future__ import annotations

import argparse
import copy
import json
import math
import os
import shutil
import statistics
import subprocess
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path

from common import (HERE, Cell, Page, Point, Rect, SpecError, abs_rects, block_size, edge_polyline,
                    label_box, load_config, load_spec, point_at_fraction, polyline_length, read_drawio,
                    rects_overlap, snap, snap_up, wrap_label)
from route import _compress, choose_sides, route_edge

# ------------------------------------------------------------------ styles (edit here)
BLOCK_STYLES = {
    "module": "rounded=1;arcSize=8;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=12;",
    "memory": "shape=cylinder3;boundedLbl=1;backgroundOutline=1;size=10;whiteSpace=wrap;html=1;"
              "fillColor=#fff2cc;strokeColor=#d6b656;fontSize=12;",
    "io": "rounded=1;arcSize=40;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=12;",
    "external": "rounded=0;whiteSpace=wrap;html=1;dashed=1;fillColor=#f5f5f5;strokeColor=#666666;"
                "fontColor=#333333;fontSize=12;",
}
CONTAINER_STYLE = ("rounded=1;arcSize=2;whiteSpace=wrap;html=1;container=1;collapsible=0;recursiveResize=0;"
                   "verticalAlign=top;align=left;spacingLeft=10;spacingTop=6;fontStyle=1;fontSize=13;"
                   "strokeColor=#9aa0a6;fillColor={fill};")
CONTAINER_FILLS = ["#f8f9fa", "#eceff3", "#e2e6eb"]  # by nesting depth
EDGE_BASE = ("edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;"
             "labelBackgroundColor=#ffffff;fontSize=11;")
EDGE_KINDS = {
    "data": "strokeColor=#333333;strokeWidth=2;endArrow=block;endFill=1;",
    "control": "strokeColor=#333333;strokeWidth=1;dashed=1;endArrow=open;endFill=0;",
    "clock": "strokeColor=#d79b00;strokeWidth=1;endArrow=oval;endFill=1;fontColor=#9a6700;",
    "reset": "strokeColor=#b85450;strokeWidth=1;endArrow=oval;endFill=1;fontColor=#9c3a36;",
}
SIDES = {"RIGHT": ("E", "W"), "LEFT": ("W", "E"), "DOWN": ("S", "N"), "UP": ("N", "S")}
ELK_SIDE = {"E": "EAST", "W": "WEST", "S": "SOUTH", "N": "NORTH"}


class BuildError(Exception):
    """Raised for environment problems (missing node/elkjs) or ELK failures."""


# ------------------------------------------------------------------ ELK
def make_elk_graph(page: Page, cfg: dict, sizes: dict[str, tuple[int, int]]) -> dict:
    lay = cfg["layout"]
    out_side, in_side = (ELK_SIDE[s] for s in SIDES[lay["direction"]])
    kids = page.children()
    ports: dict[str, list[dict]] = {}
    for c in page.connections:
        for node_id, suffix, side in ((c.src, "out", out_side), (c.dst, "in", in_side)):
            ports.setdefault(node_id, []).append(
                {"id": f"{c.id}:{suffix}", "width": 0, "height": 0, "layoutOptions": {"elk.port.side": side}})
    pad, title = lay["container_padding"], lay["container_title_height"]

    def node(bid: str) -> dict:
        n: dict = {"id": bid}
        if bid in ports:
            n["ports"] = ports[bid]
            n["layoutOptions"] = {"elk.portConstraints": "FIXED_SIDE"}
        if kids.get(bid):
            n["children"] = [node(k) for k in kids[bid]]
            n.setdefault("layoutOptions", {})["elk.padding"] = f"[top={title},left={pad},bottom={pad},right={pad}]"
        else:
            n["width"], n["height"] = sizes[bid]
        return n

    return {
        "id": "root",
        "layoutOptions": {
            "elk.algorithm": "layered", "elk.direction": lay["direction"], "elk.edgeRouting": "ORTHOGONAL",
            "elk.hierarchyHandling": "INCLUDE_CHILDREN", "elk.json.edgeCoords": "ROOT",
            "elk.json.shapeCoords": "ROOT", "elk.padding": "[top=20,left=20,bottom=20,right=20]",
            "elk.spacing.nodeNode": str(lay["node_spacing"]),
            "elk.layered.spacing.nodeNodeBetweenLayers": str(lay["layer_spacing"]),
            "elk.spacing.edgeNode": "30", "elk.spacing.edgeEdge": "20",
            "elk.layered.spacing.edgeNodeBetweenLayers": "30", "elk.layered.spacing.edgeEdgeBetweenLayers": "20",
            "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
        },
        "children": [node(k) for k in kids.get(None, [])],
        "edges": [{"id": c.id, "sources": [f"{c.id}:out"], "targets": [f"{c.id}:in"],
                   "labels": [{"text": c.label, "width": len(c.label) * 6.5 + 10, "height": 16}]}
                  for c in page.connections],
    }


def run_elk(graph: dict) -> dict:
    node = shutil.which("node")
    if not node:
        raise BuildError("Node.js not found on PATH (needed for ELK layout). Install Node 18+.")
    if not (HERE / "node_modules" / "elkjs").exists():
        raise BuildError(f"elkjs is not installed. Run: cd {HERE} && npm install")
    proc = subprocess.run([node, str(HERE / "elk_layout.js")], input=json.dumps(graph), capture_output=True,
                          text=True, cwd=HERE, timeout=180)
    if proc.returncode != 0:
        raise BuildError(f"ELK layout failed: {proc.stderr.strip() or proc.stdout.strip()}")
    return json.loads(proc.stdout)


def parse_elk(result: dict) -> tuple[dict[str, Rect], dict[str, list[Point]]]:
    rects: dict[str, Rect] = {}
    edges: dict[str, list[Point]] = {}

    def walk(n: dict) -> None:
        for e in n.get("edges", []):
            sec = e["sections"][0]
            pts = [sec["startPoint"], *sec.get("bendPoints", []), sec["endPoint"]]
            edges[e["id"]] = [(p["x"], p["y"]) for p in pts]
        for c in n.get("children", []):
            rects[c["id"]] = Rect(c["x"], c["y"], c["width"], c["height"])
            walk(c)

    walk(result)
    return rects, edges


# ------------------------------------------------------------------ layout planning
@dataclass
class EdgeGeo:
    full: list[Point]  # exit point, waypoints, entry point
    exit: tuple[float, float]
    entry: tuple[float, float]
    label_pos: float = 0.0

    @property
    def points(self) -> list[Point]:  # interior waypoints only (what draw.io stores)
        return self.full[1:-1]


@dataclass
class Layout:
    rects: dict[str, Rect]
    order: list[str]
    pinned: set[str] = field(default_factory=set)
    kept_edges: set[str] = field(default_factory=set)
    edges: dict[str, EdgeGeo] = field(default_factory=dict)


def _order(page: Page) -> list[str]:
    kids, out = page.children(), []
    queue = list(kids.get(None, []))
    while queue:
        b = queue.pop(0)
        out.append(b)
        queue.extend(kids.get(b, []))
    return out


def _clamp(v: float, lo: float, hi: float) -> float:
    return min(max(v, lo), hi)


def _anchor(r: Rect, side: str, ref: Point) -> Point:
    if side == "E":
        return (r.right, _clamp(ref[1], r.y, r.bottom))
    if side == "W":
        return (r.x, _clamp(ref[1], r.y, r.bottom))
    if side == "S":
        return (_clamp(ref[0], r.x, r.right), r.bottom)
    return (_clamp(ref[0], r.x, r.right), r.y)


def _longest_segment_pos(pts: list[Point]) -> float:
    total = polyline_length(pts)
    best, run = (-1.0, 0.0), 0.0
    for a, b in zip(pts, pts[1:]):
        seg = math.dist(a, b)
        if seg > best[0]:
            best = (seg, run + seg / 2)
        run += seg
    return round(2 * (best[1] / total if total else 0.5) - 1, 3)


def choose_label(pts: list[Point], text: str, blocks: list[Rect], placed: list[Rect],
                 char_width: float) -> tuple[float, Rect]:
    """Pick the label position along an edge: clear of blocks and other labels, off the bends, near the middle."""
    total = polyline_length(pts)
    best: tuple[tuple[int, float], float, Rect] | None = None
    for k in range(1, max(int(total // 10), 1)):
        t = k * 10 / total
        box = label_box(text, point_at_fraction(pts, t), char_width)
        if any(rects_overlap(box, b, tol=1) for b in blocks) or any(rects_overlap(box, p, tol=1) for p in placed):
            continue
        bends = sum(1 for x, y in pts[1:-1] if box.x - 4 <= x <= box.right + 4 and box.y - 4 <= y <= box.bottom + 4)
        score = (bends, abs(t - 0.5))
        if best is None or score < best[0]:
            best = (score, round(2 * t - 1, 3), box)
    if best is not None:
        return best[1], best[2]
    pos = _longest_segment_pos(pts)  # nothing fits: fall back (the linter will report it)
    return pos, label_box(text, point_at_fraction(pts, (pos + 1) / 2), char_width)


def _edge_from_elk(raw: list[Point], s: Rect, d: Rect, sides: tuple[str, str], g: int) -> EdgeGeo:
    pts = [(float(snap(x, g)), float(snap(y, g))) for x, y in raw]
    s_side, d_side = sides
    p0, p1 = _anchor(s, s_side, pts[0]), _anchor(d, d_side, pts[-1])
    pts[0], pts[-1] = p0, p1
    if len(pts) == 2 and p0[0] != p1[0] and p0[1] != p1[1]:  # straight edge became diagonal: add a jog
        if s_side in "EW":
            mid = float(snap((p0[0] + p1[0]) / 2, g))
            pts = [p0, (mid, p0[1]), (mid, p1[1]), p1]
        else:
            mid = float(snap((p0[1] + p1[1]) / 2, g))
            pts = [p0, (p0[0], mid), (p1[0], mid), p1]
    else:  # keep first/last segment orthogonal after endpoint snapping
        a, b = pts[0], pts[1]
        if a[0] != b[0] and a[1] != b[1]:
            pts.insert(1, (b[0], a[1]) if s_side in "EW" else (a[0], b[1]))
        a, b = pts[-2], pts[-1]
        if a[0] != b[0] and a[1] != b[1]:
            pts.insert(len(pts) - 1, (a[0], b[1]) if d_side in "EW" else (b[0], a[1]))
    pts = _compress(pts)
    exit_f = (round((p0[0] - s.x) / s.w, 4), round((p0[1] - s.y) / s.h, 4))
    entry_f = (round((p1[0] - d.x) / d.w, 4), round((p1[1] - d.y) / d.h, 4))
    return EdgeGeo(pts, exit_f, entry_f)


def plan_layout(page: Page, cfg: dict, old: dict[str, Cell] | None, relayout: bool) -> Layout:
    lay_cfg = cfg["layout"]
    g, sp = lay_cfg["grid"], lay_cfg["node_spacing"]
    pad, title = lay_cfg["container_padding"], lay_cfg["container_title_height"]
    bm, kids, order = page.block_map(), page.children(), _order(page)
    fresh = relayout or not old
    old = old or {}
    old_abs = abs_rects(old) if old else {}

    pinned: set[str] = set()
    if not fresh:
        for bid in order:
            c, b = old.get(bid), bm[bid]
            if (c and c.kind == "vertex" and c.w > 0 and c.h > 0 and c.parent == (b.parent or "1")
                    and (b.parent is None or b.parent in pinned)):
                pinned.add(bid)

    sizes = {b.id: block_size(b.label, cfg) for b in page.blocks}
    elk_rects: dict[str, Rect] = {}
    elk_edges: dict[str, list[Point]] = {}
    if fresh or len(pinned) < len(page.blocks):
        elk_rects, elk_edges = parse_elk(run_elk(make_elk_graph(page, cfg, sizes)))
    selk = {i: Rect(snap(r.x, g), snap(r.y, g), snap_up(r.w, g), snap_up(r.h, g)) for i, r in elk_rects.items()}

    rects: dict[str, Rect] = {}
    changed: set[str] = set()
    for bid in order:  # pinned blocks first, so new blocks can avoid them
        if bid in pinned:
            c, parent = old[bid], rects.get(bm[bid].parent) if bm[bid].parent else None
            ox, oy = (parent.x, parent.y) if parent else (0.0, 0.0)
            rects[bid] = Rect(ox + c.x, oy + c.y, c.w, c.h)
    for bid in order:
        if bid in pinned:
            continue
        changed.add(bid)
        b, er = bm[bid], selk[bid]
        if fresh:
            rects[bid] = er
            continue
        deltas = [(rects[s].x - selk[s].x, rects[s].y - selk[s].y) for s in kids.get(b.parent, []) if s in pinned]
        if deltas:
            dx, dy = statistics.median(d[0] for d in deltas), statistics.median(d[1] for d in deltas)
        elif b.parent:
            dx, dy = rects[b.parent].x - selk[b.parent].x, rects[b.parent].y - selk[b.parent].y
        else:
            dx = dy = 0
        x, y = snap(er.x + dx, g), snap(er.y + dy, g)
        if b.parent:
            x, y = max(x, snap_up(rects[b.parent].x + pad, g)), max(y, snap_up(rects[b.parent].y + title, g))
        for _ in range(200):  # push down until clear of siblings
            cand = Rect(x - sp, y - sp, er.w + 2 * sp, er.h + 2 * sp)
            hit = next((rects[s] for s in kids.get(b.parent, []) if s in rects and s != bid
                        and rects_overlap(cand, rects[s])), None)
            if hit is None:
                break
            y = snap_up(hit.bottom + sp, g)
        rects[bid] = Rect(x, y, er.w, er.h)
    for bid in reversed(order):  # grow containers (children first) to hold new/changed children
        if bid not in kids:
            continue
        r, need_r, need_b = rects[bid], rects[bid].right, rects[bid].bottom
        for k in kids[bid]:
            if k in changed:
                need_r, need_b = max(need_r, rects[k].right + pad), max(need_b, rects[k].bottom + pad)
        if (need_r, need_b) != (r.right, r.bottom):
            rects[bid] = Rect(r.x, r.y, snap_up(need_r - r.x, g), snap_up(need_b - r.y, g))
            changed.add(bid)

    result = Layout(rects, order, pinned)
    sides = SIDES[lay_cfg["direction"]]
    polys: dict[str, list[Point]] = {}
    for conn in page.connections:  # pass 1: edges whose geometry is kept as it is
        oe = None if fresh else old.get(conn.id)
        if (oe and oe.kind == "edge" and (oe.source, oe.target) == (conn.src, conn.dst)
                and old_abs.get(conn.src) == rects[conn.src] and old_abs.get(conn.dst) == rects[conn.dst]):
            poly = edge_polyline(oe, old_abs)
            if poly:
                result.kept_edges.add(conn.id)
                polys[conn.id] = poly
    used: dict[tuple[str, str], int] = {}
    for conn in page.connections:  # pass 2: ELK-routed (fresh) or A*-routed (incremental) edges
        if conn.id in result.kept_edges:
            continue
        s, d = rects[conn.src], rects[conn.dst]
        if fresh and conn.id in elk_edges:
            geo = _edge_from_elk(elk_edges[conn.id], s, d, sides, g)
        else:
            s_side, d_side = choose_sides(s, d)
            offs = []
            for key in ((conn.src, s_side), (conn.dst, d_side)):
                k = used.get(key, 0)
                used[key] = k + 1
                offs.append((-1) ** k * ((k + 1) // 2) * 2 * g)
            skip = {conn.src, conn.dst, *page.ancestors(conn.src), *page.ancestors(conn.dst)}
            obstacles = [r for i, r in rects.items() if i not in skip]  # incl. unrelated containers
            rt = route_edge(s, d, obstacles, g, src_offset=offs[0], dst_offset=offs[1], avoid=list(polys.values()))
            geo = EdgeGeo(rt.points, rt.exit, rt.entry)
        result.edges[conn.id] = geo
        polys[conn.id] = geo.full
    cw = lay_cfg["char_width"]  # pass 3: label positions
    leaf_rects = [r for i, r in rects.items() if i not in page.container_ids()]
    placed = [label_box(c.label, point_at_fraction(polys[c.id], (old[c.id].label_pos + 1) / 2), cw)
              for c in page.connections if c.id in result.kept_edges]
    for conn in page.connections:
        if conn.id not in result.kept_edges:
            geo = result.edges[conn.id]
            geo.label_pos, box = choose_label(geo.full, conn.label, leaf_rects, placed, cw)
            placed.append(box)
    return result


# ------------------------------------------------------------------ XML emission
def _num(v: float) -> str:
    return str(int(v)) if float(v).is_integer() else str(round(v, 2))


def _depth(page: Page, bid: str) -> int:
    return len(page.ancestors(bid))


def _label_value(label: str, cfg: dict, wrap: bool) -> str:
    if not wrap:
        return label.replace("\\n", "<br>").replace("\n", "<br>")
    return "<br>".join(wrap_label(label, cfg["layout"]["max_chars_per_line"]))


def build_page(page: Page, cfg: dict, old: dict[str, Cell] | None, relayout: bool, restyle: bool,
               index: int, manifest_ids: set[str] | None) -> tuple[ET.Element, list[str]]:
    layout = plan_layout(page, cfg, old, relayout)
    rects, bm, containers = layout.rects, page.block_map(), page.container_ids()
    old = old or {}
    model_attrs = {"grid": "1", "gridSize": str(cfg["layout"]["grid"]), "guides": "1", "tooltips": "1",
                   "connect": "1", "arrows": "1", "fold": "1", "page": "1", "pageScale": "1", "math": "0",
                   "shadow": "0"}
    edge_pts = [p for e in layout.edges.values() for p in e.points]
    edge_pts += [p for cid in layout.kept_edges for p in old[cid].points]
    xs = [r.right for r in rects.values()] + [p[0] for p in edge_pts] or [0]
    ys = [r.bottom for r in rects.values()] + [p[1] for p in edge_pts] or [0]
    model_attrs.update(dx=str(int(max(xs)) + 40), dy=str(int(max(ys)) + 40),
                       pageWidth=str(int(max(xs)) + 80), pageHeight=str(int(max(ys)) + 80))
    slug = "".join(ch if ch.isalnum() else "_" for ch in page.name.lower())
    diagram = ET.Element("diagram", {"id": f"page_{index}_{slug}", "name": page.name})
    root = ET.SubElement(ET.SubElement(diagram, "mxGraphModel", model_attrs), "root")
    ET.SubElement(root, "mxCell", {"id": "0"})
    ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})
    generated: list[str] = []

    for bid in layout.order:
        b, r = bm[bid], rects[bid]
        parent_rect = rects[b.parent] if b.parent else Rect(0, 0, 0, 0)
        style = (CONTAINER_STYLE.format(fill=CONTAINER_FILLS[min(_depth(page, bid), 2)]) if bid in containers
                 else BLOCK_STYLES[b.type])
        value = _label_value(b.label, cfg, wrap=bid not in containers)
        if bid in layout.pinned:
            el = copy.deepcopy(old[bid].element)
            el.set("value", value)
            if restyle:
                el.set("style", style)
            geo = el.find("mxGeometry")
            if geo is not None:  # container growth only changes the size
                geo.set("width", _num(r.w))
                geo.set("height", _num(r.h))
        else:
            el = ET.Element("mxCell", {"id": bid, "value": value, "style": style, "vertex": "1",
                                       "parent": b.parent or "1"})
            ET.SubElement(el, "mxGeometry", {"x": _num(r.x - parent_rect.x), "y": _num(r.y - parent_rect.y),
                                             "width": _num(r.w), "height": _num(r.h), "as": "geometry"})
        root.append(el)
        generated.append(bid)

    for conn in page.connections:
        generated.append(conn.id)
        if conn.id in layout.kept_edges:
            el = copy.deepcopy(old[conn.id].element)
            el.set("value", conn.label)
            if restyle:
                el.set("style", _edge_style(conn, None))
            root.append(el)
            continue
        geo = layout.edges[conn.id]
        el = ET.Element("mxCell", {"id": conn.id, "value": conn.label, "style": _edge_style(conn, geo),
                                   "edge": "1", "parent": "1", "source": conn.src, "target": conn.dst})
        g_el = ET.SubElement(el, "mxGeometry", {"relative": "1", "as": "geometry"})
        if geo.label_pos:
            g_el.set("x", _num(geo.label_pos))
        if geo.points:
            arr = ET.SubElement(g_el, "Array", {"as": "points"})
            for x, y in geo.points:
                ET.SubElement(arr, "mxPoint", {"x": _num(x), "y": _num(y)})
        root.append(el)

    ids_now = set(generated)  # keep cells the user added by hand (not generated earlier, not in spec)
    for cid, cell in old.items():
        if manifest_ids is None or cid in manifest_ids or cid in ids_now or cell.element is None:
            continue
        if cell.parent != "1" and cell.parent not in ids_now:
            continue
        if cell.kind == "edge" and ((cell.source and cell.source not in ids_now) or
                                    (cell.target and cell.target not in ids_now)):
            continue
        root.append(copy.deepcopy(cell.element))
    return diagram, generated


def _edge_style(conn, geo: EdgeGeo | None) -> str:
    style = EDGE_BASE + EDGE_KINDS[conn.kind]
    if conn.style == "dashed":
        style += "dashed=1;"
    if conn.bidirectional:
        style += "startArrow=block;startFill=1;"
    if geo is not None:
        style += (f"exitX={geo.exit[0]};exitY={geo.exit[1]};exitDx=0;exitDy=0;"
                  f"entryX={geo.entry[0]};entryY={geo.entry[1]};entryDx=0;entryDy=0;")
    return style


def build(spec_path: Path, out_path: Path, cfg: dict, relayout: bool = False, restyle: bool = False) -> Path:
    spec_path, out_path = Path(spec_path), Path(out_path)
    spec = load_spec(spec_path, cfg)
    old_pages = read_drawio(out_path) if out_path.exists() else {}
    manifest_path = out_path.with_name(out_path.name + ".manifest.json")
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else None
    mxfile = ET.Element("mxfile", {"host": "app.diagrams.net", "agent": "block-diagram-kit", "version": "24.0.0"})
    new_manifest: dict[str, list[str]] = {}
    for i, page in enumerate(spec.pages, start=1):
        old = old_pages.get(page.name)
        ids = set(manifest[page.name]) if manifest and page.name in manifest else None
        diagram, generated = build_page(page, cfg, old, relayout, restyle, i, ids)
        mxfile.append(diagram)
        new_manifest[page.name] = generated
    if out_path.exists() and manifest:  # keep pages the user added by hand
        for diagram in ET.parse(out_path).getroot().findall("diagram"):
            if diagram.get("name") not in new_manifest and diagram.get("name") not in manifest:
                mxfile.append(diagram)
    ET.indent(mxfile, space="  ")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(mxfile).write(out_path, encoding="utf-8")
    manifest_path.write_text(json.dumps(new_manifest, indent=2))
    return out_path


# ------------------------------------------------------------------ export + CLI
def export_png(drawio_file: Path, cfg: dict, page_names: list[str]) -> list[Path]:
    cli = shutil.which(cfg["drawio_cli"]) or (cfg["drawio_cli"] if Path(cfg["drawio_cli"]).exists() else None)
    if not cli:
        raise BuildError(f"draw.io CLI '{cfg['drawio_cli']}' not found. Install draw.io desktop or set "
                         f"drawio_cli in diagram.config.yaml.")
    outputs = []
    for i, name in enumerate(page_names):
        suffix = "" if len(page_names) == 1 else "_" + "".join(c if c.isalnum() else "_" for c in name.lower())
        png = drawio_file.with_name(f"{drawio_file.stem}{suffix}.png")
        cmd = [cli, "-x", "-f", "png", "-s", "2", "-p", str(i), "--embed-diagram", "-o", str(png), str(drawio_file)]
        if sys.platform.startswith("linux"):
            cmd.insert(1, "--no-sandbox")
            if not os.environ.get("DISPLAY") and shutil.which("xvfb-run"):
                cmd = ["xvfb-run", "-a", *cmd]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        if proc.returncode != 0 or not png.exists():
            raise BuildError(f"draw.io export failed for page '{name}': {proc.stderr.strip()[:300]}")
        outputs.append(png)
    return outputs


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("spec", type=Path)
    ap.add_argument("-o", "--output", type=Path, default=Path("system.drawio"))
    ap.add_argument("--config", type=Path, default=None)
    ap.add_argument("--relayout", action="store_true", help="discard existing geometry and lay out fresh")
    ap.add_argument("--restyle", action="store_true", help="re-apply generated styles to existing cells")
    ap.add_argument("--no-lint", action="store_true")
    ap.add_argument("--export", choices=["png"], default=None, help="export pages with the draw.io CLI")
    args = ap.parse_args(argv)
    cfg = load_config(args.config)
    try:
        build(args.spec, args.output, cfg, args.relayout, args.restyle)
    except (SpecError, BuildError) as err:
        print(f"BUILD FAILED:\n{err}", file=sys.stderr)
        return 2
    print(f"wrote {args.output}")
    code = 0
    if not args.no_lint:
        from lint_diagram import lint_file, print_report
        report = lint_file(args.output, cfg, args.spec)
        print_report(report)
        code = 1 if report.errors else 0
    if args.export:
        try:
            names = [p.name for p in load_spec(args.spec, cfg).pages]
            for png in export_png(args.output, cfg, names):
                print(f"exported {png}")
        except BuildError as err:
            print(f"EXPORT FAILED: {err}", file=sys.stderr)
            return max(code, 3)
    return code


if __name__ == "__main__":
    sys.exit(main())
