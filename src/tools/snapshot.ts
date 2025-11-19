/**
 * Board Snapshot Tool
 * 
 * Provides complete board state in a single API call using nested resource expansion.
 * This is the MVP feature that eliminates multiple round trips.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TrelloCredentials } from '../types/common.js';
import { TrelloCache } from '../utils/cache.js';
import { resolveBoardId } from '../utils/resolver.js';
import { cleanBoard, cleanCard } from '../utils/cleaner.js';
import { createSuccessResponse, createErrorResponse } from '../utils/api.js';

export function registerSnapshotTools(
    server: McpServer,
    credentials: TrelloCredentials,
    cache: TrelloCache
) {
    server.tool(
        'get_board_snapshot',
        'Get complete board state with all lists and cards in a single call. This provides "God Mode" visibility of the entire project.',
        {
            board_name: z.string().optional().describe('Name of the Trello board (optional if TRELLO_DEFAULT_BOARD is set)'),
        },
        async ({ board_name }) => {
            try {
                // Use provided board_name or fall back to environment variable
                const boardName = (board_name || process.env.TRELLO_DEFAULT_BOARD || '').trim();

                if (!boardName) {
                    return createErrorResponse(
                        'Board name is required. Either provide board_name parameter or set TRELLO_DEFAULT_BOARD environment variable.'
                    );
                }

                const allowedBoards = process.env.TRELLO_ALLOWED_BOARDS
                    ? process.env.TRELLO_ALLOWED_BOARDS.split(',').map((b) => b.trim().toLowerCase()).filter(Boolean)
                    : null;

                if (allowedBoards && !allowedBoards.includes(boardName.toLowerCase())) {
                    return createErrorResponse(`Access Denied: The board '${boardName}' is not in the allowed list.`);
                }

                // Resolve board name to ID
                const { id: boardId } = await resolveBoardId(boardName, credentials, cache);

                // Fetch board with nested expansion - single API call!
                const url = new URL(`https://api.trello.com/1/boards/${boardId}`);
                url.searchParams.append('key', credentials.apiKey);
                url.searchParams.append('token', credentials.apiToken);
                url.searchParams.append('lists', 'all');
                url.searchParams.append('cards', 'visible');
                url.searchParams.append('members', 'all');
                url.searchParams.append('labels', 'all');
                url.searchParams.append('card_fields', 'name,desc,due,labels,idMembers,url,closed,idChecklists,idList');
                url.searchParams.append('card_checklists', 'all');

                const response = await fetch(url.toString());

                if (!response.ok) {
                    return createErrorResponse(`Failed to fetch board: ${response.statusText}`);
                }

                const boardData = await response.json();

                // Stitch cards into their lists before cleaning
                if (Array.isArray(boardData.cards) && Array.isArray(boardData.lists)) {
                    const cardsByList = boardData.cards.reduce((acc: Record<string, any[]>, card: any) => {
                        if (!card?.idList) {
                            return acc;
                        }
                        if (!acc[card.idList]) {
                            acc[card.idList] = [];
                        }
                        acc[card.idList].push(card);
                        return acc;
                    }, {});

                    boardData.lists = boardData.lists.map((list: any) => ({
                        ...list,
                        cards: cardsByList[list.id] || [],
                    }));
                }

                // Clean the response to remove UI noise
                const cleanedBoard = cleanBoard(boardData);

                return createSuccessResponse({
                    boardName: cleanedBoard.name,
                    boardId: cleanedBoard.id,
                    boardUrl: cleanedBoard.url,
                    description: cleanedBoard.desc,
                    lists: cleanedBoard.lists || [],
                });
            } catch (error) {
                return createErrorResponse(`Error getting board snapshot: ${error}`);
            }
        }
    );

    server.tool(
        'get_archived_cards',
        'Get archived (closed) cards from a board',
        {
            board_name: z.string().optional().describe('Name of the Trello board (optional if TRELLO_DEFAULT_BOARD is set)'),
        },
        async ({ board_name }) => {
            try {
                // Use provided board_name or fall back to environment variable
                const boardName = board_name || process.env.TRELLO_DEFAULT_BOARD;

                if (!boardName) {
                    return createErrorResponse(
                        'Board name is required. Either provide board_name parameter or set TRELLO_DEFAULT_BOARD environment variable.'
                    );
                }

                // Resolve board name to ID
                const { id: boardId } = await resolveBoardId(boardName, credentials, cache);

                // Fetch archived cards
                const url = new URL(`https://api.trello.com/1/boards/${boardId}/cards/closed`);
                url.searchParams.append('key', credentials.apiKey);
                url.searchParams.append('token', credentials.apiToken);

                const response = await fetch(url.toString());

                if (!response.ok) {
                    return createErrorResponse(`Failed to fetch archived cards: ${response.statusText}`);
                }

                const cards = await response.json();

                // Clean the response
                const cleanedCards = cards.map((card: any) => cleanCard(card));

                return createSuccessResponse({
                    cards: cleanedCards
                });
            } catch (error) {
                return createErrorResponse(`Error getting archived cards: ${error}`);
            }
        }
    );
}
