#!/usr/bin/env python3
"""Lint a .drawio block diagram: geometry, routing, label fit and agreement with the spec.

    python lint_diagram.py system.drawio [--spec spec.yaml] [--config diagram.config.yaml]

Output is one line per issue, easy for an agent to act on:
    ERROR page=<page> rule=<rule> cells=<id,id> detail=<text>
    WARN  page=<page> rule=<rule> cells=<id,id> detail=<text>
    SUMMARY errors=<n> warnings=<n>
Exit code 1 if there are errors, else 0.
"""
from __future__ import annotations

import argparse
import html
import itertools
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

from common import (Cell, Page, Point, Rect, abs_rects, edge_polyline, label_box, label_fits,
                    load_config, load_spec, point_at_fraction, read_drawio, rects_overlap,
                    seg_hits_rect, segs_cross)


@dataclass
class Issue:
    severity: str  # "ERROR" | "WARN"
    page: str
    rule: str
    cells: list[str]
    detail: str

    def __str__(self) -> str:
        return f"{self.severity} page={self.page} rule={self.rule} cells={','.join(self.cells) or '-'} detail={self.detail}"


@dataclass
class Report:
    issues: list[Issue] = field(default_factory=list)

    @property
    def errors(self) -> list[Issue]:
        return [i for i in self.issues if i.severity == "ERROR"]

    @property
    def warnings(self) -> list[Issue]:
        return [i for i in self.issues if i.severity == "WARN"]


def print_report(report: Report, stream=None) -> None:
    out = stream or sys.stdout
    for issue in report.issues:
        print(issue, file=out)
    print(f"SUMMARY errors={len(report.errors)} warnings={len(report.warnings)}", file=out)


def _text_lines(value: str) -> list[str]:
    parts = re.split(r"<br\s*/?>|\n", value or "")
    return [html.unescape(re.sub(r"<[^>]+>", "", p)).strip() for p in parts if p.strip()]


def _edge_polyline(edge: Cell, cells: dict[str, Cell], rects: dict[str, Rect]) -> list[Point] | None:
    return edge_polyline(edge, rects)


def _ancestors(cid: str, cells: dict[str, Cell]) -> set[str]:
    out: set[str] = set()
    cur = cells[cid].parent if cid in cells else None
    while cur in cells and cur not in out:
        out.add(cur)
        cur = cells[cur].parent
    return out


def lint_page(name: str, cells: dict[str, Cell], cfg: dict, spec_page: Page | None = None) -> list[Issue]:
    issues: list[Issue] = []
    g = cfg["layout"]["grid"]
    rects = abs_rects(cells)
    verts = {i: c for i, c in cells.items() if c.kind == "vertex"}
    edges = {i: c for i, c in cells.items() if c.kind == "edge"}
    containers = {c.parent for c in verts.values() if c.parent in verts}

    def add(sev: str, rule: str, ids: list[str], detail: str) -> None:
        issues.append(Issue(sev, name, rule, ids, detail))

    # 1. overlaps and containment
    by_parent: dict[str, list[str]] = {}
    for i, c in verts.items():
        by_parent.setdefault(c.parent, []).append(i)
    for siblings in by_parent.values():
        for a, b in itertools.combinations(siblings, 2):
            if rects_overlap(rects[a], rects[b]):
                add("ERROR", "overlap", [a, b], "blocks overlap")
    for i, c in verts.items():
        if c.parent in verts and not rects[c.parent].contains(rects[i]):
            add("ERROR", "outside-container", [i, c.parent], "block extends outside its container")

    # 5. dangling edges
    polylines: dict[str, list[Point]] = {}
    for i, e in edges.items():
        pts = _edge_polyline(e, cells, rects)
        if pts is None:
            add("ERROR", "dangling-edge", [i], f"source={e.source} target={e.target} not connected to blocks")
        else:
            polylines[i] = pts

    # 2. edge routing: passing through blocks, diagonal segments
    for i, pts in polylines.items():
        e = edges[i]
        skip = {e.source, e.target} | _ancestors(e.source, cells) | _ancestors(e.target, cells)
        for v in verts:
            if v in skip:
                continue
            if any(seg_hits_rect(a, b, rects[v]) for a, b in zip(pts, pts[1:])):
                add("ERROR", "edge-through-block", [i, v], f"edge {e.source}->{e.target} passes through '{v}'")
        if any(abs(a[0] - b[0]) > 0.5 and abs(a[1] - b[1]) > 0.5 for a, b in zip(pts, pts[1:])):
            add("WARN", "diagonal", [i], "edge has a diagonal segment")

    # 3. edge-edge crossings
    pairs: list[tuple[str, str]] = []
    for (ia, pa), (ib, pb) in itertools.combinations(polylines.items(), 2):
        n = sum(segs_cross(a1, a2, b1, b2) for a1, a2 in zip(pa, pa[1:]) for b1, b2 in zip(pb, pb[1:]))
        pairs.extend([(ia, ib)] * n)
    if pairs:
        shown = sorted({f"{a}x{b}" for a, b in pairs})[:5]
        add("WARN", "edge-crossings", sorted({x for p in pairs for x in p})[:6], f"{len(pairs)} crossings, e.g. {'; '.join(shown)}")

    # 4. label fit and label overlaps
    for i, c in verts.items():
        lines = _text_lines(c.value)
        if not lines:
            continue
        if i in containers:
            ok = max(len(ln) for ln in lines) * cfg["layout"]["char_width"] + 20 <= c.w
        else:
            ok = label_fits(lines, c.w, c.h, cfg)
        if not ok:
            add("ERROR", "label-overflow", [i], f"label '{' '.join(lines)}' does not fit {int(c.w)}x{int(c.h)}")
    label_rects: dict[str, Rect] = {}
    cw = cfg["layout"]["char_width"]
    for i, pts in polylines.items():
        text = " ".join(_text_lines(edges[i].value))
        if not text:
            continue
        label_rects[i] = label_box(text, point_at_fraction(pts, (edges[i].label_pos + 1) / 2), cw)
    for i, lr in label_rects.items():
        for v, c in verts.items():
            if v not in containers and rects_overlap(lr, rects[v], tol=1):
                add("ERROR", "label-overlap-block", [i, v], f"label '{edges[i].value}' overlaps block '{v}'")
    for (ia, ra), (ib, rb) in itertools.combinations(label_rects.items(), 2):
        if rects_overlap(ra, rb, tol=1):
            add("ERROR", "label-overlap-label", [ia, ib], "edge labels overlap")

    # 6. agreement with the spec
    if spec_page is not None:
        for b in spec_page.blocks:
            c = verts.get(b.id)
            if c is None:
                add("ERROR", "missing-block", [b.id], "block in spec but not in diagram")
            elif c.parent != (b.parent or "1"):
                add("ERROR", "wrong-parent", [b.id], f"expected parent {b.parent or 'top level'}, found {c.parent}")
        for cn in spec_page.connections:
            e = edges.get(cn.id)
            if e is None:
                add("ERROR", "missing-connection", [cn.id], f"connection {cn.src}->{cn.dst} in spec but not in diagram")
            elif (e.source, e.target) != (cn.src, cn.dst):
                add("ERROR", "wrong-endpoint", [cn.id], f"expected {cn.src}->{cn.dst}, found {e.source}->{e.target}")
        spec_ids = {b.id for b in spec_page.blocks} | {c.id for c in spec_page.connections}
        for i in [*verts, *edges]:
            if i not in spec_ids:
                add("WARN", "extra-cell", [i], "cell not in spec (hand-added?)")

    # 7. grid alignment
    off = [i for i, c in verts.items() if any(abs(v / g - round(v / g)) > 1e-6 for v in (rects[i].x, rects[i].y, c.w, c.h))]
    off += [i for i, pts in polylines.items() if any(abs(v / g - round(v / g)) > 1e-6 for p in pts[1:-1] for v in p)]
    if off:
        add("WARN", "off-grid", off[:8], f"{len(off)} cells not aligned to the {g}px grid")
    return issues


def lint_file(path: str | Path, cfg: dict | None = None, spec_path: str | Path | None = None) -> Report:
    cfg = cfg or load_config()
    pages = read_drawio(path)
    report = Report()
    spec_pages = {p.name: p for p in load_spec(spec_path, cfg).pages} if spec_path else {}
    for name, cells in pages.items():
        report.issues += lint_page(name, cells, cfg, spec_pages.get(name))
    for name in spec_pages:
        if name not in pages:
            report.issues.append(Issue("ERROR", name, "missing-page", [], "page in spec but not in diagram"))
    return report


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("drawio", type=Path)
    ap.add_argument("--spec", type=Path, default=None)
    ap.add_argument("--config", type=Path, default=None)
    args = ap.parse_args(argv)
    report = lint_file(args.drawio, load_config(args.config), args.spec)
    print_report(report)
    return 1 if report.errors else 0


if __name__ == "__main__":
    sys.exit(main())
