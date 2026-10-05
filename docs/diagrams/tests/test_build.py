"""Tests for spec validation and the builder (fresh builds and ID-preserving rebuilds)."""
import shutil
import xml.etree.ElementTree as ET

import pytest
import yaml
from conftest import needs_elk

from build_diagram import build
from common import SpecError, abs_rects, parse_spec, read_drawio
from lint_diagram import lint_file


def _spec(blocks, conns=(), name="P"):
    return {"pages": [{"name": name, "blocks": list(blocks), "connections": list(conns)}]}


def _block(i, **kw):
    return {"id": i, "label": i.upper(), **kw}


# ---------------------------------------------------------------- spec validation
@pytest.mark.parametrize("data, message", [
    (_spec([_block("a"), _block("a")]), "duplicate block id"),
    (_spec([_block("a", parent="nope")]), "unknown parent"),
    (_spec([_block("a", parent="b"), _block("b", parent="a")]), "parent cycle"),
    (_spec([{"id": "a", "label": "x" * 30}]), "label longer than 24"),
    (_spec([_block("a"), _block("b")], [{"from": "a", "to": "zzz", "label": "x"}]), "unknown block"),
    (_spec([_block("a"), _block("b")], [{"from": "a", "to": "b", "label": "y" * 21}]), "label longer than 20"),
    (_spec([_block("a"), _block("b")], [{"from": "a", "to": "b"}]), "needs a label"),
    (_spec([_block("a")], [{"from": "a", "to": "a", "label": "x"}]), "self-loop"),
    (_spec([_block(f"b{i}") for i in range(13)]), "exceeds max_blocks_per_page"),
    (_spec([_block("Bad-Id")]), "snake_case"),
    (_spec([_block("a", type="weird")]), "type 'weird'"),
    ({"pages": []}, "non-empty 'pages'"),
])
def test_spec_errors(cfg, data, message):
    with pytest.raises(SpecError) as err:
        parse_spec(data, cfg)
    assert message in str(err.value)


def test_spec_parses_example(cfg, example_spec):
    from common import load_spec
    spec = load_spec(example_spec, cfg)
    assert [p.name for p in spec.pages] == ["Top Level", "Peripherals"]
    top = spec.pages[0]
    assert {c.id for c in top.connections} >= {"bus__uart__1", "clk_gen__soc__1", "clk_gen__soc__2"}
    assert top.block_map()["periph"].type == "container"


# ---------------------------------------------------------------- fresh builds
@needs_elk
def test_example_builds_and_lints_without_errors(cfg, example_spec, tmp_path):
    out = tmp_path / "system.drawio"
    build(example_spec, out, cfg)
    report = lint_file(out, cfg, example_spec)
    assert not report.errors, "\n".join(map(str, report.errors))


@needs_elk
def test_build_is_deterministic(cfg, example_spec, tmp_path):
    a, b = tmp_path / "a.drawio", tmp_path / "b.drawio"
    build(example_spec, a, cfg)
    build(example_spec, b, cfg)
    assert a.read_text() == b.read_text()


@needs_elk
def test_children_are_nested_and_edges_reference_leaf_blocks(cfg, example_spec, tmp_path):
    out = tmp_path / "system.drawio"
    build(example_spec, out, cfg)
    cells = read_drawio(out)["Top Level"]
    assert cells["uart"].parent == "periph" and cells["periph"].parent == "soc" and cells["soc"].parent == "1"
    assert (cells["bus__uart__1"].source, cells["bus__uart__1"].target) == ("bus", "uart")
    assert (cells["clk_gen__soc__1"].source, cells["clk_gen__soc__1"].target) == ("clk_gen", "soc")
    assert "exitX=" in cells["bus__uart__1"].style and "entryX=" in cells["bus__uart__1"].style


# ---------------------------------------------------------------- ID-preserving rebuilds
def _move_block(path, page_name, cell_id, dx, dy):
    tree = ET.parse(path)
    for diagram in tree.getroot().findall("diagram"):
        if diagram.get("name") != page_name:
            continue
        for el in diagram.iter("mxCell"):
            if el.get("id") == cell_id:
                geo = el.find("mxGeometry")
                geo.set("x", str(float(geo.get("x")) + dx))
                geo.set("y", str(float(geo.get("y")) + dy))
    tree.write(path, encoding="utf-8")


@needs_elk
def test_rebuild_keeps_manual_moves(cfg, example_spec, tmp_path):
    out = tmp_path / "system.drawio"
    build(example_spec, out, cfg)
    before = read_drawio(out)["Top Level"]
    _move_block(out, "Top Level", "ddr", 0, 120)  # manual edit in draw.io
    moved = {i: (r.x, r.y, r.w, r.h) for i, r in abs_rects(read_drawio(out)["Top Level"]).items()}
    build(example_spec, out, cfg)  # regenerate from the unchanged spec
    after = read_drawio(out)["Top Level"]
    assert {i: (r.x, r.y, r.w, r.h) for i, r in abs_rects(after).items()} == moved
    assert after["ddr"].y == before["ddr"].y + 120  # the hand edit survived
    assert after["ddr_ctrl__ddr__1"].points == before["ddr_ctrl__ddr__1"].points  # kept edge untouched


@needs_elk
def test_rebuild_adds_new_block_without_moving_existing(cfg, example_spec, tmp_path):
    out = tmp_path / "system.drawio"
    build(example_spec, out, cfg)
    old_rects = abs_rects(read_drawio(out)["Top Level"])
    data = yaml.safe_load(example_spec.read_text())
    top = data["pages"][0]
    top["blocks"] += [{"id": "dma", "label": "DMA Engine", "parent": "soc", "type": "module"},
                      {"id": "sram", "label": "On-chip SRAM", "type": "memory"}]
    top["connections"] += [{"from": "dma", "to": "bus", "label": "AXI4", "kind": "data"},
                           {"from": "bus", "to": "sram", "label": "AXI4", "kind": "data"}]
    spec_path = tmp_path / "spec.yaml"
    spec_path.write_text(yaml.safe_dump(data))
    build(spec_path, out, cfg)
    new_cells = read_drawio(out)["Top Level"]
    new_rects = abs_rects(new_cells)
    for bid, rect in old_rects.items():  # containers may only grow, never move
        assert (new_rects[bid].x, new_rects[bid].y) == (rect.x, rect.y), bid
        if bid not in ("soc", "periph"):
            assert new_rects[bid] == rect, bid
    assert {"dma", "sram", "dma__bus__1", "bus__sram__1"} <= set(new_cells)
    report = lint_file(out, cfg, spec_path)
    assert not report.errors, "\n".join(map(str, report.errors))


@needs_elk
def test_relayout_discards_manual_moves(cfg, example_spec, tmp_path):
    out = tmp_path / "system.drawio"
    build(example_spec, out, cfg)
    original = read_drawio(out)["Top Level"]["ddr"].y
    _move_block(out, "Top Level", "ddr", 0, 120)
    build(example_spec, out, cfg, relayout=True)
    assert read_drawio(out)["Top Level"]["ddr"].y == original


@needs_elk
def test_removed_block_and_its_edges_disappear(cfg, example_spec, tmp_path):
    out = tmp_path / "system.drawio"
    build(example_spec, out, cfg)
    data = yaml.safe_load(example_spec.read_text())
    top = data["pages"][0]
    top["blocks"] = [b for b in top["blocks"] if b["id"] != "gpio"]
    top["connections"] = [c for c in top["connections"] if "gpio" not in (c["from"], c["to"])]
    spec_path = tmp_path / "spec.yaml"
    spec_path.write_text(yaml.safe_dump(data))
    build(spec_path, out, cfg)
    cells = read_drawio(out)["Top Level"]
    assert "gpio" not in cells and "bus__gpio__1" not in cells and "uart" in cells


@needs_elk
def test_hand_added_cells_survive_rebuild(cfg, example_spec, tmp_path):
    out = tmp_path / "system.drawio"
    build(example_spec, out, cfg)
    tree = ET.parse(out)
    root = tree.getroot().find("diagram").find("mxGraphModel").find("root")
    note = ET.SubElement(root, "mxCell", {"id": "my_note", "value": "TODO: add PLL", "style": "text;html=1;",
                                          "vertex": "1", "parent": "1"})
    ET.SubElement(note, "mxGeometry", {"x": "20", "y": "20", "width": "100", "height": "30", "as": "geometry"})
    tree.write(out, encoding="utf-8")
    build(example_spec, out, cfg)
    assert "my_note" in read_drawio(out)["Top Level"]
    report = lint_file(out, cfg, example_spec)
    assert any(i.rule == "extra-cell" and i.cells == ["my_note"] for i in report.warnings)


@needs_elk
def test_label_edit_in_spec_updates_kept_cell(cfg, example_spec, tmp_path):
    out = tmp_path / "system.drawio"
    build(example_spec, out, cfg)
    data = yaml.safe_load(example_spec.read_text())
    data["pages"][0]["blocks"][1]["label"] = "CPU Cluster"
    spec_path = tmp_path / "spec.yaml"
    spec_path.write_text(yaml.safe_dump(data))
    build(spec_path, out, cfg)
    assert read_drawio(out)["Top Level"]["cpu"].value == "CPU Cluster"


def test_build_without_node_fails_cleanly(cfg, example_spec, tmp_path, monkeypatch):
    from build_diagram import BuildError
    monkeypatch.setattr(shutil, "which", lambda *_a, **_k: None)
    with pytest.raises(BuildError, match="Node.js not found"):
        build(example_spec, tmp_path / "x.drawio", cfg)
