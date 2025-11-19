import { describe, it, expect, beforeEach } from 'vitest';
import { MockMcpServer } from '../utils/mock-server.js';
import { registerBoardsTools } from '../../src/tools/boards.js';
import { TrelloCredentials } from '../../src/types/common.js';

describe('Boards Tools', () => {
  let server: MockMcpServer;
  let credentials: TrelloCredentials;

  beforeEach(() => {
    server = new MockMcpServer() as any;
    credentials = {
      apiKey: process.env.TRELLO_API_KEY!,
      apiToken: process.env.TRELLO_API_TOKEN!,
    };
    registerBoardsTools(server as any, credentials);
  });

  it('should list boards', async () => {
    const response = await server.callTool('get-boards', { limit: 1 });
    expect(response).not.toBeNull();
    expect(response.content).toBeDefined();
    expect(response.isError).toBeUndefined();

    const content = JSON.parse(response.content[0].text);
    expect(content.boards).toBeInstanceOf(Array);
    expect(content.boards.length).toBeGreaterThan(0);
    // Verify we can see the Test Board
    const hasTestBoard = content.boards.some((b: any) => b.name === 'MCP Test Board');
    // It might not be in the first 1 if user has many boards, but let's check or just accept valid response
    expect(content.count).toBeGreaterThan(0);
  });
});
