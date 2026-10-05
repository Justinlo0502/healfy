#!/usr/bin/env node
/**
 * Reads an ELK graph (JSON) from stdin, lays it out with elkjs and writes the
 * laid-out graph (JSON) to stdout. Used by build_diagram.py.
 *
 * All layout options live in the graph itself (see build_diagram.py), so this
 * script stays a thin, dependency-light wrapper.
 */
const ELK = require("elkjs");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", async () => {
  try {
    const graph = JSON.parse(input);
    const elk = new ELK();
    const result = await elk.layout(graph);
    process.stdout.write(JSON.stringify(result));
  } catch (err) {
    process.stderr.write(`elk_layout.js failed: ${err && err.message ? err.message : err}\n`);
    process.exit(1);
  }
});
