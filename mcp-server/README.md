# Healfy MCP server

Exposes Healfy's own data (activities, training load, recovery, planned vs.
actual) to Claude Desktop over stdio — no `ANTHROPIC_API_KEY` needed, since
Claude Desktop is the model here; this process only answers tool calls.

Reuses `executeTool()` from `../src/lib/chat-tools.ts` directly, so it's the
exact same data/logic as the in-app coach — just reachable from Claude
Desktop (covered by your Pro plan) instead of the API.

## Setup

Nothing to install beyond what's already in the main `package.json`
(`npm install` at the repo root covers it).

Add this to Claude Desktop's config file — on Windows,
`%APPDATA%\Claude\claude_desktop_config.json` — under `"mcpServers"`:

```json
{
  "mcpServers": {
    "healfy": {
      "command": "node",
      "args": [
        "C:\\Users\\oneth\\workdir\\healfy\\node_modules\\tsx\\dist\\cli.mjs",
        "C:\\Users\\oneth\\workdir\\healfy\\mcp-server\\index.ts"
      ]
    }
  }
}
```

(Uses `node` pointed directly at tsx's CLI entry file, rather than `npx tsx`
— `npx`'s resolution depends on the spawning process's working directory,
which Claude Desktop doesn't guarantee. This sidesteps that.)

Restart Claude Desktop after saving. It should show "healfy" as a connected
MCP server, and you can ask it things like "what did I run this week" or
"am I overtraining" — answered from your real, current Healfy data.

## Manual test (no Claude Desktop needed)

```
node node_modules/tsx/dist/cli.mjs mcp-server/index.ts
```

Then paste a JSON-RPC request on stdin, e.g.:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}
```
