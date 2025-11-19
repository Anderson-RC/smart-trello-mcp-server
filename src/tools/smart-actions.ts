/**
 * Smart Actions Tools
 * 
 * Semantic actions using human-readable names instead of IDs.
 * Uses Trello Search API for scalability on large boards.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TrelloCredentials } from '../types/common.js';
import { TrelloCache } from '../utils/cache.js';
import { resolveBoardId, resolveListId, resolveCardId } from '../utils/resolver.js';
import { cleanCard } from '../utils/cleaner.js';
import { createSuccessResponse, createErrorResponse } from '../utils/api.js';

export function registerSmartActionTools(
    server: McpServer,
    credentials: TrelloCredentials,
    cache: TrelloCache
) {
    /**
     * Add Card Smart - Create a card using semantic addressing
     */
    server.tool(
        'add_card_smart',
        'Create a new card using board and list names (no IDs needed). The server handles all ID resolution internally.',
        {
            board_name: z.string().optional().describe('Name of the Trello board (optional if TRELLO_DEFAULT_BOARD is set)'),
            list_name: z.string().describe('Name of the list to add the card to'),
            card_title: z.string().describe('Title of the new card'),
            description: z.string().optional().describe('Optional description for the card'),
        },
        async ({ board_name, list_name, card_title, description }) => {
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

                // Resolve list name to ID
                const { id: listId } = await resolveListId(boardId, list_name, credentials, cache);

                // Create the card
                const url = new URL('https://api.trello.com/1/cards');
                url.searchParams.append('key', credentials.apiKey);
                url.searchParams.append('token', credentials.apiToken);
                url.searchParams.append('idList', listId);
                url.searchParams.append('name', card_title);
                if (description) {
                    url.searchParams.append('desc', description);
                }

                const response = await fetch(url.toString(), { method: 'POST' });

                if (!response.ok) {
                    return createErrorResponse(`Failed to create card: ${response.statusText}`);
                }

                const cardData = await response.json();
                const cleanedCard = cleanCard(cardData);

                return createSuccessResponse({
                    message: `Card "${card_title}" created successfully in list "${list_name}"`,
                    card: cleanedCard,
                });
            } catch (error) {
                return createErrorResponse(`Error creating card: ${error}`);
            }
        }
    );

    /**
     * Move Card Smart - Move a card using semantic addressing
     */
    server.tool(
        'move_card_smart',
        'Move a card to a different list using card and list names (no IDs needed). Uses Trello Search API for scalability.',
        {
            board_name: z.string().optional().describe('Name of the Trello board (optional if TRELLO_DEFAULT_BOARD is set)'),
            card_name: z.string().describe('Name of the card to move'),
            target_list_name: z.string().describe('Name of the target list'),
        },
        async ({ board_name, card_name, target_list_name }) => {
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

                // Find card using Search API (scalable for large boards)
                const card = await resolveCardId(boardId, card_name, credentials);

                // Resolve target list name to ID
                const { id: targetListId } = await resolveListId(boardId, target_list_name, credentials, cache);

                // Move the card
                const url = new URL(`https://api.trello.com/1/cards/${card.id}`);
                url.searchParams.append('key', credentials.apiKey);
                url.searchParams.append('token', credentials.apiToken);
                url.searchParams.append('idList', targetListId);

                const response = await fetch(url.toString(), { method: 'PUT' });

                if (!response.ok) {
                    return createErrorResponse(`Failed to move card: ${response.statusText}`);
                }

                const cardData = await response.json();
                const cleanedCard = cleanCard(cardData);

                return createSuccessResponse({
                    message: `Card "${card.name}" moved to list "${target_list_name}"`,
                    card: cleanedCard,
                });
            } catch (error) {
                return createErrorResponse(`Error moving card: ${error}`);
            }
        }
    );

    /**
     * Update Card Smart - Update a card using semantic addressing
     */
    server.tool(
        'update_card_smart',
        'Update a card using its name (no ID needed). Uses Trello Search API for scalability.',
        {
            board_name: z.string().optional().describe('Name of the Trello board (optional if TRELLO_DEFAULT_BOARD is set)'),
            card_name: z.string().describe('Name of the card to update'),
            name: z.string().optional().describe('New name for the card'),
            desc: z.string().optional().describe('New description for the card'),
            due: z.string().optional().describe('New due date (ISO 8601 format)'),
        },
        async ({ board_name, card_name, name, desc, due }) => {
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

                // Find card using Search API (scalable for large boards)
                const card = await resolveCardId(boardId, card_name, credentials);

                // Update the card
                const url = new URL(`https://api.trello.com/1/cards/${card.id}`);
                url.searchParams.append('key', credentials.apiKey);
                url.searchParams.append('token', credentials.apiToken);

                if (name) url.searchParams.append('name', name);
                if (desc) url.searchParams.append('desc', desc);
                if (due) url.searchParams.append('due', due);

                const response = await fetch(url.toString(), { method: 'PUT' });

                if (!response.ok) {
                    return createErrorResponse(`Failed to update card: ${response.statusText}`);
                }

                const cardData = await response.json();
                const cleanedCard = cleanCard(cardData);

                return createSuccessResponse({
                    message: `Card "${card.name}" updated successfully`,
                    card: cleanedCard,
                });
            } catch (error) {
                return createErrorResponse(`Error updating card: ${error}`);
            }
        }
    );

    /**
     * Restore Card Smart - Restore an archived card
     */
    server.tool(
        'restore_card_smart',
        'Restore an archived (closed) card using its name. Searches specifically for archived cards.',
        {
            board_name: z.string().optional().describe('Name of the Trello board (optional if TRELLO_DEFAULT_BOARD is set)'),
            card_name: z.string().describe('Name of the card to restore'),
        },
        async ({ board_name, card_name }) => {
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

                // Search for the card using specific query for archived cards
                const query = `name:"${card_name}" is:archived board:${boardId}`;
                const searchUrl = new URL('https://api.trello.com/1/search');
                searchUrl.searchParams.append('key', credentials.apiKey);
                searchUrl.searchParams.append('token', credentials.apiToken);
                searchUrl.searchParams.append('query', query);
                searchUrl.searchParams.append('modelTypes', 'cards');
                searchUrl.searchParams.append('cards_limit', '10');

                const searchResponse = await fetch(searchUrl.toString());
                if (!searchResponse.ok) {
                    return createErrorResponse(`Failed to search for archived card: ${searchResponse.statusText}`);
                }

                const searchResults = await searchResponse.json();
                const cards = searchResults.cards || [];

                if (cards.length === 0) {
                    return createErrorResponse(`No archived card found with name "${card_name}" on board "${boardName}"`);
                }

                // Take the first match (or most recent)
                const cardToRestore = cards[0];

                // Restore the card
                const url = new URL(`https://api.trello.com/1/cards/${cardToRestore.id}`);
                url.searchParams.append('key', credentials.apiKey);
                url.searchParams.append('token', credentials.apiToken);
                
                const response = await fetch(url.toString(), {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ closed: false }),
                });

                if (!response.ok) {
                    return createErrorResponse(`Failed to restore card: ${response.statusText}`);
                }

                const cardData = await response.json();
                const cleanedCard = cleanCard(cardData);

                return createSuccessResponse({
                    message: `Card "${cardToRestore.name}" restored successfully`,
                    card: cleanedCard,
                });
            } catch (error) {
                return createErrorResponse(`Error restoring card: ${error}`);
            }
        }
    );
}
