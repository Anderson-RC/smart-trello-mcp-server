import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockMcpServer } from '../utils/mock-server.js';
import { registerSmartActionTools } from '../../src/tools/smart-actions.js';
import { registerCardsTools } from '../../src/tools/cards.js';
import { registerSearchTools } from '../../src/tools/search.js';
import { TrelloCredentials } from '../../src/types/common.js';
import { TrelloCache } from '../../src/utils/cache.js';

describe('Smart Tools', () => {
  let server: MockMcpServer;
  let credentials: TrelloCredentials;
  let cache: TrelloCache;
  let createdCardId: string | null = null;

  const BOARD_NAME = process.env.TRELLO_DEFAULT_BOARD || 'MCP Test Board';
  const LIST_TODO = 'To Do';
  const LIST_DOING = 'In Progress';
  const SEARCH_MAX_ATTEMPTS = 10;
  const SEARCH_RETRY_DELAY_MS = 2000;

  const makeTestCardTitle = (label: string) => `${label} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const parseResponse = <T = any>(res: any): T => {
    const raw = res?.content?.[0]?.text;
    return raw ? (JSON.parse(raw) as T) : ({} as T);
  };

  async function waitForCardInSearch(cardName: string) {
    for (let attempt = 0; attempt < SEARCH_MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await delay(SEARCH_RETRY_DELAY_MS);
      }

      const searchRes = await server.callTool('search_cards', {
        query: `name:"${cardName}" board:"${BOARD_NAME}"`,
      });

      if (!searchRes.isError) {
        const searchData = parseResponse<{ cards?: any[] }>(searchRes);
        if (searchData.cards?.some((card) => card.name === cardName)) {
          return true;
        }
      }
    }

    return false;
  }

  async function retrySmartCall(action: () => Promise<any>, label: string) {
    let lastError = 'unknown error';

    for (let attempt = 0; attempt < SEARCH_MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await delay(SEARCH_RETRY_DELAY_MS);
      }

      try {
        const result = await action();
        if (!result?.isError) {
          return result;
        }

        lastError = result?.content?.[0]?.text ?? lastError;
      } catch (error: any) {
        lastError = error?.message ?? String(error);
      }
    }

    throw new Error(`Failed ${label} after ${SEARCH_MAX_ATTEMPTS} attempts: ${lastError}`);
  }

  beforeEach(() => {
    server = new MockMcpServer() as any;
    credentials = {
      apiKey: process.env.TRELLO_API_KEY!,
      apiToken: process.env.TRELLO_API_TOKEN!,
    };
    cache = new TrelloCache();
    
    registerSmartActionTools(server as any, credentials, cache);
    registerCardsTools(server as any, credentials);
    registerSearchTools(server as any, credentials);
  });

  afterEach(async () => {
    if (createdCardId) {
      try {
        await server.callTool('archive-card', { cardId: createdCardId });
      } catch (e) {
        console.error('Failed to cleanup card:', e);
      }
      createdCardId = null;
    }
  });

  it('should create, move, and update a card', async () => {
    const testCardTitle = makeTestCardTitle('Smart Tool Card');
    // 1. Create Card
    const createRes = await server.callTool('add_card_smart', {
      board_name: BOARD_NAME,
      list_name: LIST_TODO,
      card_title: testCardTitle,
      description: 'Integration Test Card',
    });
    
    expect(createRes.isError).toBeUndefined();
    const createData = parseResponse(createRes);
    // The smart tool returns { message, card }
    expect(createData.card).toBeDefined();
    createdCardId = createData.card.id;
    expect(createData.card.name).toBe(testCardTitle);

    const indexed = await waitForCardInSearch(testCardTitle);
    if (!indexed) {
      throw new Error('Timed out waiting for Trello search indexing');
    }

    const moveRes = await retrySmartCall(
      () =>
        server.callTool('move_card_smart', {
          board_name: BOARD_NAME,
          card_name: testCardTitle,
          target_list_name: LIST_DOING,
        }),
      'moving card via smart action'
    );

    const moveData = parseResponse(moveRes);
    expect(moveData.card.id).toBe(createdCardId);

    // 3. Update Card
    const updateRes = await retrySmartCall(
      () =>
        server.callTool('update_card_smart', {
          board_name: BOARD_NAME,
          card_name: testCardTitle,
          desc: 'Updated Description',
        }),
      'updating card via smart action'
    );

    const updateData = parseResponse(updateRes);
    expect(updateData.card.desc).toBe('Updated Description');
  }, 30000); // Increase timeout to 30s

  it('should archive and restore a card', async () => {
    const restoreCardTitle = makeTestCardTitle('Restore Card');

    const createRes = await server.callTool('add_card_smart', {
      board_name: BOARD_NAME,
      list_name: LIST_TODO,
      card_title: restoreCardTitle,
      description: 'Restore Test Card',
    });

    expect(createRes.isError).toBeUndefined();
    const createData = parseResponse(createRes);
    createdCardId = createData.card.id;
    expect(createData.card.name).toBe(restoreCardTitle);

    const indexed = await waitForCardInSearch(restoreCardTitle);
    if (!indexed) {
      throw new Error('Timed out waiting for Trello search indexing before restore');
    }

    const archiveRes = await server.callTool('archive-card', { cardId: createdCardId });
    expect(archiveRes.isError).toBeUndefined();

    const restoreRes = await retrySmartCall(
      () =>
        server.callTool('restore_card_smart', {
          board_name: BOARD_NAME,
          card_name: restoreCardTitle,
        }),
      'restoring card via smart action'
    );

    const restoreData = parseResponse(restoreRes);
    expect(restoreData.card.id).toBe(createdCardId);
    expect(restoreData.card.closed).toBe(false);
  }, 30000);
});
