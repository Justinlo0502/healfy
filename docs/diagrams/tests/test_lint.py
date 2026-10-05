"""One minimal failing case per lint rule, plus a clean baseline."""
from pathlib import Path

import pytest

from common import load_config, parse_spec
from lint_diagram import lint_file, main


def make_drawio(path: Path, vertices, edges=(), page="P") -> Path:
    """vertices: (id, label, x, y, w, h[, parent]); edges: dict(id, source, target, points, style, value, pos)."""
    cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>']
    for v in vertices:
        vid, label, x, y, w, h = v[:6]
        parent = v[6] if len(v) > 6 else "1"
        cells.append(f'<mxCell id="{vid}" value="{label}" style="rounded=1;html=1;" vertex="1" parent="{parent}">'
                     f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')
    for e in edges:
        pts = "".join(f'<mxPoint x="{x}" y="{y}"/>' for x, y in e.get("points", []))
        arr = f'<Array as="points">{pts}</Array>' if pts else ""
        src, tgt = e.get("source"), e.get("target")
        attrs = (f' source="{src}"' if src else "") + (f' target="{tgt}"' if tgt else "")
        cells.append(f'<mxCell id="{e["id"]}" value="{e.get("value", "")}" style="{e.get("style", "")}" edge="1" '
                     f'parent="1"{attrs}><mxGeometry x="{e.get("pos", 0)}" relative="1" as="geometry">{arr}'
                     f'</mxGeometry></mxCell>')
    xml = (f'<mxfile><diagram id="d" name="{page}"><mxGraphModel><root>{"".join(cells)}</root></mxGraphModel>'
           f'</diagram></mxfile>')
    path.write_text(xml)
    return path


RIGHT_TO_LEFT = "exitX=1;exitY=0.5;entryX=0;entryY=0.5;"


def rules(report, severity=None):
    return {(i.rule) for i in report.issues if severity in (None, i.severity)}


@pytest.fixture()
def cfg():
    return load_config()


def base(tmp_path):
    return make_drawio(
        tmp_path / "ok.drawio",
        [("a", "A", 0, 0, 120, 60), ("b", "B", 240, 0, 120, 60)],
        [dict(id="a__b__1", source="a", target="b", style=RIGHT_TO_LEFT, value="bus")],
    )


def test_clean_diagram_has_no_issues(tmp_path, cfg):
    assert lint_file(base(tmp_path), cfg).issues == []


def test_overlap(tmp_path, cfg):
    f = make_drawio(tmp_path / "x.drawio", [("a", "A", 0, 0, 120, 60), ("b", "B", 60, 20, 120, 60)])
    assert "overlap" in rules(lint_file(f, cfg), "ERROR")


def test_child_outside_container(tmp_path, cfg):
    f = make_drawio(tmp_path / "x.drawio", [("c", "C", 0, 0, 200, 150), ("k", "K", 150, 40, 120, 60, "c")])
    assert "outside-container" in rules(lint_file(f, cfg), "ERROR")


def test_edge_passes_through_unrelated_block(tmp_path, cfg):
    f = make_drawio(
        tmp_path / "x.drawio",
        [("a", "A", 0, 0, 120, 60), ("mid", "M", 200, 0, 120, 60), ("b", "B", 400, 0, 120, 60)],
        [dict(id="a__b__1", source="a", target="b", style=RIGHT_TO_LEFT)],
    )
    report = lint_file(f, cfg)
    hit = [i for i in report.errors if i.rule == "edge-through-block"]
    assert hit and set(hit[0].cells) == {"a__b__1", "mid"}


def test_edge_may_cross_ancestor_container(tmp_path, cfg):
    f = make_drawio(
        tmp_path / "x.drawio",
        [("c", "C", 0, 0, 400, 200), ("a", "A", 40, 60, 120, 60, "c"), ("b", "B", 600, 60, 120, 60)],
        [dict(id="a__b__1", source="a", target="b", style="exitX=1;exitY=0.5;entryX=0;entryY=0.5;")],
    )
    assert "edge-through-block" not in rules(lint_file(f, cfg))


def test_edge_crossings_warn(tmp_path, cfg):
    f = make_drawio(
        tmp_path / "x.drawio",
        [("a", "A", 0, 100, 120, 60), ("b", "B", 400, 100, 120, 60), ("c", "C", 240, 0, 120, 60),
         ("d", "D", 240, 300, 120, 60)],
        [dict(id="a__b__1", source="a", target="b", style=RIGHT_TO_LEFT),
         dict(id="c__d__1", source="c", target="d", style="exitX=0.5;exitY=1;entryX=0.5;entryY=0;")],
    )
    report = lint_file(f, cfg)
    assert "edge-crossings" in rules(report, "WARN") and not report.errors


def test_label_overflow(tmp_path, cfg):
    f = make_drawio(tmp_path / "x.drawio", [("a", "A very long block label that cannot fit", 0, 0, 60, 30)])
    assert "label-overflow" in rules(lint_file(f, cfg), "ERROR")


def test_edge_label_overlaps_block(tmp_path, cfg):
    f = make_drawio(
        tmp_path / "x.drawio",
        [("a", "A", 0, 0, 120, 60), ("b", "B", 140, 0, 120, 60)],
        [dict(id="a__b__1", source="a", target="b", style=RIGHT_TO_LEFT, value="AXI4-Stream-Long")],
    )
    assert "label-overlap-block" in rules(lint_file(f, cfg), "ERROR")


def test_edge_labels_overlap_each_other(tmp_path, cfg):
    f = make_drawio(
        tmp_path / "x.drawio",
        [("a", "A", 0, 0, 120, 60), ("b", "B", 400, 0, 120, 60), ("c", "C", 0, 20, 120, 60), ("d", "D", 400, 20, 120, 60)],
        [dict(id="e1", source="a", target="b", style=RIGHT_TO_LEFT, value="first"),
         dict(id="e2", source="c", target="d", style="exitX=1;exitY=0.25;entryX=0;entryY=0.25;", value="second")],
    )
    assert "label-overlap-label" in rules(lint_file(f, cfg), "ERROR")


def test_dangling_edge(tmp_path, cfg):
    f = make_drawio(tmp_path / "x.drawio", [("a", "A", 0, 0, 120, 60)], [dict(id="e", source="a")])
    assert "dangling-edge" in rules(lint_file(f, cfg), "ERROR")


SPEC = {"pages": [{"name": "P", "blocks": [{"id": "a", "label": "A"}, {"id": "b", "label": "B"},
                                           {"id": "k", "label": "K", "parent": "b"}],
                   "connections": [{"from": "a", "to": "k", "label": "bus"}]}]}


def spec_file(tmp_path, cfg):
    import yaml
    p = tmp_path / "spec.yaml"
    p.write_text(yaml.safe_dump(SPEC))
    parse_spec(SPEC, cfg)  # sanity: the spec itself is valid
    return p


def test_spec_missing_block_and_connection(tmp_path, cfg):
    f = make_drawio(tmp_path / "x.drawio", [("a", "A", 0, 0, 120, 60)])
    report = lint_file(f, cfg, spec_file(tmp_path, cfg))
    assert {"missing-block", "missing-connection"} <= rules(report, "ERROR")


def test_spec_edge_attached_to_container_instead_of_sub_block(tmp_path, cfg):
    f = make_drawio(
        tmp_path / "x.drawio",
        [("a", "A", 0, 0, 120, 60), ("b", "B", 300, 0, 240, 160), ("k", "K", 340, 50, 120, 60, "b")],
        [dict(id="a__k__1", source="a", target="b", style=RIGHT_TO_LEFT, value="bus")],
    )
    report = lint_file(f, cfg, spec_file(tmp_path, cfg))
    wrong = [i for i in report.errors if i.rule == "wrong-endpoint"]
    assert wrong and "expected a->k, found a->b" in wrong[0].detail


def test_spec_wrong_parent(tmp_path, cfg):
    f = make_drawio(
        tmp_path / "x.drawio",
        [("a", "A", 0, 0, 120, 60), ("b", "B", 300, 0, 240, 160), ("k", "K", 700, 50, 120, 60)],
        [dict(id="a__k__1", source="a", target="k", style=RIGHT_TO_LEFT, value="bus")],
    )
    assert "wrong-parent" in rules(lint_file(f, cfg, spec_file(tmp_path, cfg)), "ERROR")


def test_off_grid_and_diagonal_are_warnings(tmp_path, cfg):
    f = make_drawio(
        tmp_path / "x.drawio",
        [("a", "A", 3, 0, 120, 60), ("b", "B", 240, 100, 120, 60)],
        [dict(id="a__b__1", source="a", target="b", style=RIGHT_TO_LEFT)],
    )
    report = lint_file(f, cfg)
    assert {"off-grid", "diagonal"} <= rules(report, "WARN") and not report.errors


def test_exit_codes(tmp_path, capsys):
    ok = base(tmp_path)
    assert main([str(ok)]) == 0
    bad = make_drawio(tmp_path / "bad.drawio", [("a", "A", 0, 0, 120, 60), ("b", "B", 10, 10, 120, 60)])
    assert main([str(bad)]) == 1
    out = capsys.readouterr().out
    assert "ERROR page=P rule=overlap cells=a,b detail=" in out and "SUMMARY errors=1" in out


def test_missing_page(tmp_path, cfg):
    f = make_drawio(tmp_path / "x.drawio", [("a", "A", 0, 0, 120, 60)], page="Other")
    assert "missing-page" in rules(lint_file(f, cfg, spec_file(tmp_path, cfg)), "ERROR")
