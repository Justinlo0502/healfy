# Spec format (`spec.yaml`)

The spec describes **what the system is**. It never contains coordinates; layout is the build script's job.

```yaml
pages:                          # one draw.io page per entry; page 1 = top level, then one per subsystem
  - name: Top Level             # unique; also the draw.io tab name
    blocks:
      - id: soc                 # stable snake_case id (a-z, 0-9, _). Never rename; it keys manual edits.
        label: "SoC Subsystem"  # max 24 chars (use \n for a line break)
        type: container         # module | memory | io | external | container (default: module)
      - id: cpu
        label: "CPU Core"
        parent: soc             # nests this block inside the container `soc`
        source_file: src/cpu.sv # optional, for traceability
    connections:
      - from: cpu               # block id (the most specific block, not its container)
        to: bus
        label: "AXI4"           # required, max 20 chars: bus / signal / interface name
        kind: data              # data | control | clock | reset (default: data)
        style: solid            # solid | dashed (default: solid; control is dashed anyway)
        bidirectional: true     # optional, arrows on both ends
```

## Rules (enforced when the spec is loaded)

| Rule | Why |
|---|---|
| max 12 blocks per page (`limits.max_blocks_per_page`) | readable, and layout stays reliable; split into more pages instead |
| every connection has a label | an unlabeled arrow is not informative |
| ids unique per page, parents must exist, no cycles | structural validity |
| a block with children becomes a container automatically | keeps `type` consistent |
| connect to the **most specific block**; connect to a container only when the interface belongs to the whole subsystem | prevents "arrow touches the wrong box" |

## Conventions

* Cell ids in the diagram equal block ids; edge ids are `{from}__{to}__{n}` (n counts parallel connections between the same pair).
* Page 1 shows subsystems and the interfaces between them. Each subsystem gets its own page with its internals.
* Long-distance signals (clock, reset, config buses) are fine as ordinary labeled connections; if they clutter a page, draw them once as a container-level connection and leave them out of the internals.
