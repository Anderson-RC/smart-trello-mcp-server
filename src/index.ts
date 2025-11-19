import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import dotenv from 'dotenv';

// Import modular tools
// (Deprecated tools removed)

// Import new smart tools
import { registerSnapshotTools } from './tools/snapshot.js';
import { registerSmartActionTools } from './tools/smart-actions.js';
import { registerSearchTools } from './tools/search.js';

// Import types and utilities
import { TrelloCredentials } from './types/common.js';
import { TrelloCache } from './utils/cache.js';

// Load environment variables
dotenv.config();

const trelloApiKey = process.env.TRELLO_API_KEY;
const trelloApiToken = process.env.TRELLO_API_TOKEN;

// Create an MCP server
const server = new McpServer({
	name: 'Advanced Trello MCP Server',
	version: '3.0.0',
});

// Prepare credentials
const credentials: TrelloCredentials = {
	apiKey: trelloApiKey || '',
	apiToken: trelloApiToken || '',
};

// Initialize cache with 5-minute TTL
const cache = new TrelloCache(5);

// Register new smart tools
registerSnapshotTools(server, credentials, cache);
registerSmartActionTools(server, credentials, cache);
registerSearchTools(server, credentials);

// Connect to stdio transport
const transport = new StdioServerTransport();
server.connect(transport);

// Export server for testing
export default server; 