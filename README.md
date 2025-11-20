
# Trello MCP Server

A Model Context Protocol (MCP) server for Trello designed specifically for LLM agents.

This project is a hard fork of the `advanced-trello-mcp-server`. While the original repository provides a comprehensive wrapper around the Trello REST API, this implementation re-architects the interaction model to prioritize token efficiency, semantic context, and operational safety.

This server is tailored more towards personal use - to augment your LLM while working to manage a trello board to maintain flow within your workspace.

## Overview

Standard REST-based MCP tools force AI agents to perform "manual" API chaining (e.g., listing boards, then listing lists, then listing cards) to understand the state of a project. This results in high latency, excessive token consumption, and frequent errors.

This server acts as an intelligent middleware layer. It aggregates data server-side, performs fuzzy matching on names to resolve IDs, and aggressively strips UI-specific metadata. The goal is to allow an agent to understand and manipulate a board's state in a single request-response cycle. It's also designed with the intention of minimising token and context consumption through the programmatic filtration of extraneous data before it reaches the agent.

## Feature Set

### 1. Context Aggregation (The Snapshot)
**Tool:** `get_board_snapshot`
Retrieves the entire state of a board (lists, cards, and members) in a single tool call.
*   **Data Stitching:** Automatically resolves Trello's flat JSON structure into a nested hierarchy (Board > Lists > Cards).
*   **Noise Reduction:** Strips approximately 70% of the raw API response, removing background colors, emoji coordinates, legacy metadata, and positional floats to conserve the LLM's context window.
*   **Member Resolution:** Resolves opaque Member IDs (e.g., `id123`) to human-readable names within the card context.

### 2. Semantic Actions
**Tools:** `add_card_smart`, `move_card_smart`, `update_card_smart`
Agents interact with resources by name, not ID.
*   **Fuzzy Matching:** The server uses Levenshtein distance to resolve "Review List" to the correct List ID, handling typos or minor variations automatically.
*   **Self-Correction:** If a lookup fails, the server returns a list of valid nearest matches, allowing the agent to self-correct without user intervention.

### 3. Operational Safety
**Scope:** purely operational.
*   **No Administration:** Capabilities to create boards, delete lists, or modify workspace structures are intentionally removed to prevent "structure drift" and accidental data loss.
*   **Board Scoping:** Restrict the agent's access to specific boards via environment variables, preventing unauthorized access to personal or sensitive boards even if the API token has access.

### 4. Undo Capabilities
**Tools:** `get_archived_cards`, `restore_card_smart`
Allows the agent to audit closed cards and restore them by name, providing a safety net for accidental archives.

## Installation

### Prerequisites
*   Node.js (v16 or higher)
*   Trello API Key and Token (obtainable via Trello Power-Up Admin)

### Build Steps
```bash
git clone https://github.com/your-username/trello-mcp-server.git
cd trello-mcp-server
npm install
npm run build
```

## Configuration

Add the server to your MCP client configuration file (e.g., `mcp_settings.json` for VS Code extensions or `claude_desktop_config.json`).

```json
{
  "mcpServers": {
    "trello": {
      "command": "node",
      "args": ["/absolute/path/to/trello-mcp-server/build/index.js"],
      "env": {
        "TRELLO_API_KEY": "your_api_key",
        "TRELLO_TOKEN": "your_api_token",
        "TRELLO_DEFAULT_BOARD": "Project Alpha",
        "TRELLO_ALLOWED_BOARDS": "Project Alpha, Marketing, Roadmap"
      }
    }
  }
}
```

### Environment Variables

| Variable | Description | Required |
| :--- | :--- | :--- |
| `TRELLO_API_KEY` | Your Trello Power-Up API Key. | Yes |
| `TRELLO_TOKEN` | Your Trello User Token. | Yes |
| `TRELLO_DEFAULT_BOARD` | The board name to use if the agent does not specify one. | No |
| `TRELLO_ALLOWED_BOARDS`| Comma-separated list of board names the agent is permitted to access. If set, all other boards will return "Access Denied." | No |

## Usage

Once installed, the agent will utilize the tools autonomously. You can provide high-level instructions:

*   **Status Check:** "Check the Roadmap board and summary what is currently in the 'In Progress' column."
*   **Task Management:** "Add a card 'Fix Login Bug' to the Bugs list."
*   **Workflow:** "Move the 'Update Documentation' card to Done."
*   **Recovery:** "I accidentally archived a card about the logo. Please find it and put it back."

## Credits and Licensing

This project is a fork of [advanced-trello-mcp-server](https://github.com/adriangrahldev/advanced-trello-mcp-server) by Adrian Grahl.

While the original repository provides an extensive implementation of the Trello REST API as MCP tools, this fork diverges significantly in architectural philosophy. It reduces the API surface area to focus strictly on agent-optimized, high-density operations.

Licensed under the MIT License.