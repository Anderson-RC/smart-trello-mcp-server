import dotenv from 'dotenv';

// Load environment variables from .env if it exists
dotenv.config();

// Fallback credentials for testing if not in environment
if (!process.env.TRELLO_API_KEY) {
  process.env.TRELLO_API_KEY = 'd2340872fb72659853a81a36b7db4906';
}
if (!process.env.TRELLO_API_TOKEN) {
  process.env.TRELLO_API_TOKEN = 'ATTA6dbc84e379e295807efbffdf28676022d7f1eccb00e32147a2b2425ae7c33ffb023953A4';
}
if (!process.env.TRELLO_DEFAULT_BOARD) {
  process.env.TRELLO_DEFAULT_BOARD = 'MCP Test Board';
}
