// Loads the repo's .env by absolute path. MCP clients (Claude Desktop,
// Claude Code) spawn this server with an unpredictable working directory,
// so dotenv's default cwd lookup can't be relied on. Kept in its own module
// and imported first from index.ts: ESM evaluates imports in order, so this
// runs before src/lib/db.ts reads DATABASE_URL.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.resolve(__dirname, "../.env"), quiet: true });
