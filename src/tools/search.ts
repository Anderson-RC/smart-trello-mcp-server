/**
 * Search Tools
 * 
 * Filtered card search using Trello search operators.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TrelloCredentials } from '../types/common.js';
import { cleanCard } from '../utils/cleaner.js';
import { createSuccessResponse, createErrorResponse } from '../utils/api.js';

export function registerSearchTools(
    server: McpServer,
    credentials: TrelloCredentials
) {
    /**
     * Search Cards - Filter cards using Trello search operators
     */
    server.tool(
        'search_cards',
        {
            query: z.string().describe('Trello search query (e.g., "is:open list:Review label:Bug")'),
        },
        async ({ query }) => {
            try {
                // Use Trello Search API
                const url = new URL('https://api.trello.com/1/search');
                url.searchParams.append('key', credentials.apiKey);
                url.searchParams.append('token', credentials.apiToken);
                url.searchParams.append('query', query);
                url.searchParams.append('modelTypes', 'cards');
                url.searchParams.append('cards_limit', '50');
                url.searchParams.append('card_fields', 'name,desc,due,labels,idMembers,url,closed,idChecklists');
                url.searchParams.append('card_checklists', 'all');

                const response = await fetch(url.toString());

                if (!response.ok) {
                    return createErrorResponse(`Failed to search cards: ${response.statusText}`);
                }

                const result = await response.json();
                const cards = result.cards || [];

                // Clean all cards
                const cleanedCards = cards.map((card: any) => cleanCard(card));

                return createSuccessResponse({
                    query,
                    count: cleanedCards.length,
                    cards: cleanedCards,
                });
            } catch (error) {
                return createErrorResponse(`Error searching cards: ${error}`);
            }
        }
    );
}
