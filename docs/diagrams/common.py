"""Shared helpers for the block-diagram toolkit.

Contains: config loading, spec loading/validation, text sizing, geometry
helpers and a small .drawio reader used by both the builder and the linter.
"""
from __future__ import annotations

import base64
import copy
import math
import os
import re
import urllib.parse
import xml.etree.ElementTree as ET
import zlib
from dataclasses import dataclass, field
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent

DEFAULT_CONFIG: dict = {
    "drawio_cli": "drawio",
    "layout": {
        "direction": "RIGHT",  # RIGHT | DOWN | LEFT | UP
        "node_spacing": 60,
        "layer_spacing": 90,
        "container_padding": 40,
        "container_title_height": 50,
        "grid": 10,
        "min_block_width": 120,
        "min_block_height": 60,
        "char_width": 7.0,  # estimated px per character at 12px font
        "line_height": 16,
        "max_chars_per_line": 18,
    },
    "limits": {
        "max_blocks_per_page": 12,
        "max_block_label": 24,
        "max_connection_label": 20,
    },
}

BLOCK_TYPES = ("module", "memory", "io", "external", "container")
CONN_KINDS = ("data", "control", "clock", "reset")
CONN_STYLES = ("solid", "dashed")
ID_RE = re.compile(r"^[a-z][a-z0-9_]*$")


class SpecError(Exception):
    """Raised when a spec file is invalid. The message lists every problem."""


# --------------------------------------------------------------------------- config
def _merge(base: dict, extra: dict) -> dict:
    out = copy.deepcopy(base)
    for key, val in (extra or {}).items():
        if isinstance(val, dict) and isinstance(out.get(key), dict):
            out[key] = _merge(out[key], val)
        else:
            out[key] = val
    return out


def load_config(path: str | Path | None = None) -> dict:
    """Load diagram.config.yaml (next to the scripts by default) over the defaults.

    The only environment variable used is the optional DRAWIO_CLI, which overrides `drawio_cli`.
    """
    cfg_path = Path(path) if path else HERE / "diagram.config.yaml"
    cfg = copy.deepcopy(DEFAULT_CONFIG)
    if cfg_path.exists():
        with open(cfg_path, encoding="utf-8") as fh:
            cfg = _merge(DEFAULT_CONFIG, yaml.safe_load(fh) or {})
    if os.environ.get("DRAWIO_CLI"):
        cfg["drawio_cli"] = os.environ["DRAWIO_CLI"]
    return cfg


# --------------------------------------------------------------------------- spec
@dataclass
class Block:
    id: str
    label: str
    parent: str | None = None
    type: str = "module"
    source_file: str | None = None


@dataclass
class Connection:
    id: str
    src: str
    dst: str
    label: str
    kind: str = "data"
    style: str = "solid"
    bidirectional: bool = False


@dataclass
class Page:
    name: str
    blocks: list[Block] = field(default_factory=list)
    connections: list[Connection] = field(default_factory=list)

    def block_map(self) -> dict[str, Block]:
        return {b.id: b for b in self.blocks}

    def children(self) -> dict[str | None, list[str]]:
        kids: dict[str | None, list[str]] = {}
        for b in self.blocks:
            kids.setdefault(b.parent, []).append(b.id)
        return kids

    def container_ids(self) -> set[str]:
        return {b.parent for b in self.blocks if b.parent}

    def ancestors(self, block_id: str) -> list[str]:
        bm, out, cur = self.block_map(), [], self.block_map()[block_id].parent
        while cur:
            out.append(cur)
            cur = bm[cur].parent
        return out


@dataclass
class Spec:
    pages: list[Page]


def load_spec(path: str | Path, cfg: dict | None = None) -> Spec:
    """Parse and validate a spec file. Raises SpecError listing all problems."""
    cfg = cfg or load_config()
    with open(path, encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    return parse_spec(data, cfg)


def parse_spec(data: object, cfg: dict) -> Spec:
    lim = cfg["limits"]
    errors: list[str] = []
    if not isinstance(data, dict) or not isinstance(data.get("pages"), list) or not data["pages"]:
        raise SpecError("spec must be a mapping with a non-empty 'pages' list")
    pages: list[Page] = []
    seen_pages: set[str] = set()
    for pi, raw_page in enumerate(data["pages"]):
        name = str((raw_page or {}).get("name", f"page{pi + 1}"))
        where = f"page '{name}'"
        if name in seen_pages:
            errors.append(f"{where}: duplicate page name")
        seen_pages.add(name)
        page = Page(name=name)
        ids: set[str] = set()
        for rb in (raw_page or {}).get("blocks") or []:
            bid = str(rb.get("id", ""))
            if not ID_RE.match(bid):
                errors.append(f"{where}: block id '{bid}' must be snake_case (a-z, 0-9, _)")
            if bid in ids:
                errors.append(f"{where}: duplicate block id '{bid}'")
            ids.add(bid)
            label = str(rb.get("label", ""))
            if not label.strip():
                errors.append(f"{where}: block '{bid}' has no label")
            if len(label.replace("\\n", "\n").replace("\n", "")) > lim["max_block_label"]:
                errors.append(f"{where}: block '{bid}' label longer than {lim['max_block_label']} chars")
            btype = str(rb.get("type", "module"))
            if btype not in BLOCK_TYPES:
                errors.append(f"{where}: block '{bid}' type '{btype}' not in {BLOCK_TYPES}")
            page.blocks.append(Block(bid, label, rb.get("parent"), btype, rb.get("source_file")))
        if len(page.blocks) > lim["max_blocks_per_page"]:
            errors.append(
                f"{where}: {len(page.blocks)} blocks exceeds max_blocks_per_page="
                f"{lim['max_blocks_per_page']} (split into more pages)"
            )
        bm = page.block_map()
        for b in page.blocks:
            if b.parent is not None and b.parent not in bm:
                errors.append(f"{where}: block '{b.id}' has unknown parent '{b.parent}'")
        for b in page.blocks:  # parent cycles
            seen, cur = set(), b.id
            while cur is not None and cur in bm:
                if cur in seen:
                    errors.append(f"{where}: parent cycle involving '{b.id}'")
                    break
                seen.add(cur)
                cur = bm[cur].parent
        for b in page.blocks:  # anything with children is a container
            if b.id in page.container_ids():
                b.type = "container"
        counts: dict[tuple[str, str], int] = {}
        for rc in (raw_page or {}).get("connections") or []:
            src, dst = str(rc.get("from", "")), str(rc.get("to", ""))
            for end in (src, dst):
                if end not in bm:
                    errors.append(f"{where}: connection {src}->{dst} references unknown block '{end}'")
            if src == dst:
                errors.append(f"{where}: connection {src}->{dst} is a self-loop")
            label = str(rc.get("label", ""))
            if not label.strip():
                errors.append(f"{where}: connection {src}->{dst} needs a label (interface/bus name)")
            if len(label) > lim["max_connection_label"]:
                errors.append(f"{where}: connection {src}->{dst} label longer than {lim['max_connection_label']} chars")
            kind, style = str(rc.get("kind", "data")), str(rc.get("style", "solid"))
            if kind not in CONN_KINDS:
                errors.append(f"{where}: connection {src}->{dst} kind '{kind}' not in {CONN_KINDS}")
            if style not in CONN_STYLES:
                errors.append(f"{where}: connection {src}->{dst} style '{style}' not in {CONN_STYLES}")
            counts[(src, dst)] = counts.get((src, dst), 0) + 1
            page.connections.append(
                Connection(f"{src}__{dst}__{counts[(src, dst)]}", src, dst, label, kind, style,
                           bool(rc.get("bidirectional", False)))
            )
        pages.append(page)
    if errors:
        raise SpecError("\n".join(errors))
    return Spec(pages)


# --------------------------------------------------------------------------- text sizing
def wrap_label(text: str, max_chars: int) -> list[str]:
    """Wrap on spaces/underscores; explicit newlines (or the two characters \\n) are kept."""
    lines: list[str] = []
    for chunk in text.replace("\\n", "\n").split("\n"):
        cur = ""
        for word in re.findall(r"[^\s_]+_?|\s+", chunk.strip()):
            if cur and len(cur) + len(word.strip()) > max_chars and word.strip():
                lines.append(cur.strip())
                cur = ""
            cur += word
        lines.append(cur.strip())
    return [ln for ln in lines if ln] or [""]


def block_size(label: str, cfg: dict) -> tuple[int, int]:
    """Size (multiples of the grid) for a leaf block, estimated from its label."""
    lay = cfg["layout"]
    lines = wrap_label(label, lay["max_chars_per_line"])
    width = max(len(ln) for ln in lines) * lay["char_width"] + 24
    height = len(lines) * lay["line_height"] + 24
    return (max(lay["min_block_width"], snap_up(width, lay["grid"])),
            max(lay["min_block_height"], snap_up(height, lay["grid"])))


def label_fits(lines: list[str], width: float, height: float, cfg: dict) -> bool:
    """Estimate whether label lines fit a box of width x height (draw.io wraps long lines)."""
    lay = cfg["layout"]
    inner = max(width - 16, 1)
    rows = sum(max(1, math.ceil(len(ln) * lay["char_width"] / inner)) for ln in lines)
    return rows * lay["line_height"] + 8 <= height


# --------------------------------------------------------------------------- geometry
@dataclass(frozen=True)
class Rect:
    x: float
    y: float
    w: float
    h: float

    @property
    def right(self) -> float:
        return self.x + self.w

    @property
    def bottom(self) -> float:
        return self.y + self.h

    def contains(self, o: "Rect", tol: float = 0.5) -> bool:
        return (o.x >= self.x - tol and o.y >= self.y - tol
                and o.right <= self.right + tol and o.bottom <= self.bottom + tol)


Point = tuple[float, float]


def snap(v: float, g: int = 10) -> int:
    """Round to the nearest grid line, halves rounding up (Python's round() would use banker's rounding)."""
    return int(math.floor(v / g + 0.5) * g)


def snap_up(v: float, g: int = 10) -> int:
    return int(math.ceil(v / g - 1e-9) * g)


def rects_overlap(a: Rect, b: Rect, tol: float = 0.5) -> bool:
    return a.x < b.right - tol and b.x < a.right - tol and a.y < b.bottom - tol and b.y < a.bottom - tol


def seg_hits_rect(p: Point, q: Point, r: Rect, shrink: float = 1.0) -> bool:
    """True if segment p-q passes through the interior of r (shrunk by `shrink` px). Liang-Barsky."""
    xmin, xmax, ymin, ymax = r.x + shrink, r.right - shrink, r.y + shrink, r.bottom - shrink
    if xmin >= xmax or ymin >= ymax:
        return False
    dx, dy = q[0] - p[0], q[1] - p[1]
    t0, t1 = 0.0, 1.0
    for pk, qk in ((-dx, p[0] - xmin), (dx, xmax - p[0]), (-dy, p[1] - ymin), (dy, ymax - p[1])):
        if pk == 0:
            if qk < 0:
                return False
        else:
            t = qk / pk
            if pk < 0:
                t0 = max(t0, t)
            else:
                t1 = min(t1, t)
            if t0 > t1:
                return False
    return True


def segs_cross(p1: Point, p2: Point, p3: Point, p4: Point) -> bool:
    """True if the segments cross at a point interior to both (touching/collinear excluded)."""
    def orient(a: Point, b: Point, c: Point) -> float:
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    o1, o2, o3, o4 = orient(p1, p2, p3), orient(p1, p2, p4), orient(p3, p4, p1), orient(p3, p4, p2)
    return o1 * o2 < 0 and o3 * o4 < 0


def polyline_length(pts: list[Point]) -> float:
    return sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))


def point_at_fraction(pts: list[Point], t: float) -> Point:
    total = polyline_length(pts)
    if total == 0:
        return pts[0]
    target, run = t * total, 0.0
    for a, b in zip(pts, pts[1:]):
        seg = math.dist(a, b)
        if run + seg >= target and seg > 0:
            f = (target - run) / seg
            return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
        run += seg
    return pts[-1]


# --------------------------------------------------------------------------- .drawio reader
@dataclass
class Cell:
    id: str
    kind: str  # "vertex" | "edge"
    value: str
    style: str
    parent: str
    source: str | None = None
    target: str | None = None
    x: float = 0.0
    y: float = 0.0
    w: float = 0.0
    h: float = 0.0
    points: list[Point] = field(default_factory=list)
    label_pos: float = 0.0  # edge label position, -1 (source) .. 1 (target)
    element: ET.Element | None = None


def parse_style(style: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for part in (style or "").split(";"):
        if "=" in part:
            k, v = part.split("=", 1)
            out[k.strip()] = v.strip()
        elif part.strip():
            out[part.strip()] = "1"
    return out


def _model_of(diagram: ET.Element) -> ET.Element | None:
    model = diagram.find("mxGraphModel")
    if model is not None:
        return model
    text = (diagram.text or "").strip()
    if not text:
        return None
    raw = zlib.decompress(base64.b64decode(text), -15).decode("utf-8")  # compressed diagram
    return ET.fromstring(urllib.parse.unquote(raw))


def read_drawio(path: str | Path) -> dict[str, dict[str, Cell]]:
    """Return {page name: {cell id: Cell}} (the two root cells 0 and 1 are skipped)."""
    root = ET.parse(path).getroot()
    pages: dict[str, dict[str, Cell]] = {}
    diagrams = [root] if root.tag == "mxGraphModel" else root.findall("diagram")
    for i, diagram in enumerate(diagrams):
        model = diagram if diagram.tag == "mxGraphModel" else _model_of(diagram)
        name = diagram.get("name", f"Page-{i + 1}") if diagram.tag != "mxGraphModel" else "Page-1"
        cells: dict[str, Cell] = {}
        if model is None:
            pages[name] = cells
            continue
        for el in model.iter("mxCell"):
            cid = el.get("id", "")
            if cid in ("0", "1"):
                continue
            geo = el.find("mxGeometry")
            cell = Cell(cid, "edge" if el.get("edge") == "1" else "vertex", el.get("value", ""),
                        el.get("style", ""), el.get("parent", "1"), el.get("source"), el.get("target"),
                        element=el)
            if geo is not None:
                cell.x, cell.y = float(geo.get("x", 0)), float(geo.get("y", 0))
                cell.w, cell.h = float(geo.get("width", 0)), float(geo.get("height", 0))
                if cell.kind == "edge":
                    cell.label_pos = float(geo.get("x", 0))
                    arr = geo.find("Array")
                    if arr is not None:
                        cell.points = [(float(p.get("x", 0)), float(p.get("y", 0))) for p in arr.findall("mxPoint")]
            cells[cid] = cell
        pages[name] = cells
    return pages


def abs_rects(cells: dict[str, Cell]) -> dict[str, Rect]:
    """Absolute rectangles of all vertices, resolved through the parent chain."""
    out: dict[str, Rect] = {}

    def resolve(cid: str, depth: int = 0) -> Rect | None:
        if cid in out:
            return out[cid]
        cell = cells.get(cid)
        if cell is None or cell.kind != "vertex" or depth > 50:
            return None
        parent = resolve(cell.parent, depth + 1) if cell.parent in cells else None
        ox, oy = (parent.x, parent.y) if parent else (0.0, 0.0)
        out[cid] = Rect(ox + cell.x, oy + cell.y, cell.w, cell.h)
        return out[cid]

    for cid in cells:
        resolve(cid)
    return out


def edge_polyline(edge: Cell, rects: dict[str, Rect]) -> list[Point] | None:
    """Absolute polyline of an edge: exit point, waypoints, entry point (None if dangling)."""
    if edge.source not in rects or edge.target not in rects:
        return None
    style = parse_style(edge.style)
    ends: list[Point] = []
    for cid, prefix in ((edge.source, "exit"), (edge.target, "entry")):
        r = rects[cid]
        if f"{prefix}X" in style and f"{prefix}Y" in style:
            ends.append((r.x + float(style[f"{prefix}X"]) * r.w + float(style.get(f"{prefix}Dx", 0)),
                         r.y + float(style[f"{prefix}Y"]) * r.h + float(style.get(f"{prefix}Dy", 0))))
        else:
            ends.append((r.x + r.w / 2, r.y + r.h / 2))
    origin = rects.get(edge.parent)
    ox, oy = (origin.x, origin.y) if origin else (0.0, 0.0)
    return [ends[0], *[(x + ox, y + oy) for x, y in edge.points], ends[1]]


def label_box(text: str, center: Point, char_width: float) -> Rect:
    """Estimated rectangle of an edge label centered on a point of the edge."""
    w, h = len(text) * char_width * 0.92 + 8, 18
    return Rect(center[0] - w / 2, center[1] - h / 2, w, h)
