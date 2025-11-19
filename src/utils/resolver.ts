/**
 * Semantic Resolution Utilities
 * 
 * Provides name-based lookups for Trello resources with fuzzy matching
 * and helpful error messages.
 */

import { TrelloCredentials } from '../types/common.js';
import { TrelloCache } from './cache.js';

let cachedAllowedBoards: string[] | null | undefined;

function getAllowedBoards(): string[] | null {
    if (cachedAllowedBoards !== undefined) {
        return cachedAllowedBoards;
    }

    const env = process.env.TRELLO_ALLOWED_BOARDS;

    if (!env) {
        cachedAllowedBoards = null;
        return cachedAllowedBoards;
    }

    const parsed = env
        .split(',')
        .map((board) => board.trim().toLowerCase())
        .filter(Boolean);

    cachedAllowedBoards = parsed.length > 0 ? parsed : null;
    return cachedAllowedBoards;
}

function ensureBoardAllowed(boardName: string) {
    const allowedBoards = getAllowedBoards();

    if (!allowedBoards) {
        return;
    }

    const normalizedName = boardName.trim().toLowerCase();

    if (!allowedBoards.includes(normalizedName)) {
        throw new Error(`Access Denied: The board '${boardName}' is not in the allowed list.`);
    }
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two strings (0-1, higher is better)
 */
function similarityScore(a: string, b: string): number {
    const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
    const maxLength = Math.max(a.length, b.length);
    return 1 - (distance / maxLength);
}

interface FuzzyMatch {
    match: string;
    score: number;
}

/**
 * Find best fuzzy match from candidates
 */
export function fuzzyMatch(input: string, candidates: string[]): FuzzyMatch | null {
    if (candidates.length === 0) {
        return null;
    }

    const normalizedInput = input.toLowerCase().trim();
    const scores: Array<{ candidate: string; score: number }> = [];

    // Calculate scores for all candidates
    for (const candidate of candidates) {
        const score = similarityScore(normalizedInput, candidate.toLowerCase().trim());
        scores.push({ candidate, score });
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    const best = scores[0];

    // Check for ambiguity - if top 2 scores are very close (within 0.05)
    if (scores.length > 1) {
        const secondBest = scores[1];
        if (Math.abs(best.score - secondBest.score) < 0.05) {
            // Ambiguous - return null to trigger error
            return null;
        }
    }

    return {
        match: best.candidate,
        score: best.score,
    };
}

/**
 * Resolve board name to board ID
 */
export async function resolveBoardId(
    boardName: string,
    credentials: TrelloCredentials,
    cache?: TrelloCache
): Promise<{ id: string; exactMatch: boolean }> {
    ensureBoardAllowed(boardName);

    // Check cache first
    if (cache) {
        const cachedId = cache.getBoardId(boardName);
        if (cachedId) {
            return { id: cachedId, exactMatch: true };
        }
    }

    // Fetch all boards
    const url = `https://api.trello.com/1/members/me/boards?key=${credentials.apiKey}&token=${credentials.apiToken}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch boards: ${response.statusText}`);
    }

    const boards = await response.json();

    if (!Array.isArray(boards) || boards.length === 0) {
        throw new Error('No boards found for this account');
    }

    // Try exact match first (case-insensitive)
    const normalizedInput = boardName.toLowerCase().trim();
    for (const board of boards) {
        if (board.name.toLowerCase().trim() === normalizedInput) {
            // Cache the result
            if (cache) {
                cache.setBoardId(boardName, board.id);
            }
            return { id: board.id, exactMatch: true };
        }
    }

    // Try fuzzy match
    const boardNames = boards.map((b: any) => b.name);
    const match = fuzzyMatch(boardName, boardNames);

    if (!match) {
        // Ambiguous or no good match
        const availableBoards = boardNames.slice(0, 10).join('\n  - ');
        throw new Error(
            `Board "${boardName}" not found. Multiple similar matches detected.\n\nAvailable boards:\n  - ${availableBoards}`
        );
    }

    if (match.score < 0.8) {
        // No good match
        const topMatches = boardNames
            .slice(0, 5)
            .map((name: string) => `  - ${name}`)
            .join('\n');
        throw new Error(
            `Board "${boardName}" not found.\n\nDid you mean one of these?\n${topMatches}`
        );
    }

    // Good fuzzy match found
    const matchedBoard = boards.find((b: any) => b.name === match.match);

    if (cache) {
        cache.setBoardId(boardName, matchedBoard.id);
    }

    return { id: matchedBoard.id, exactMatch: false };
}

/**
 * Resolve list name to list ID within a board
 */
export async function resolveListId(
    boardId: string,
    listName: string,
    credentials: TrelloCredentials,
    cache?: TrelloCache
): Promise<{ id: string; exactMatch: boolean }> {
    // Check cache first
    if (cache) {
        const cachedId = cache.getListId(boardId, listName);
        if (cachedId) {
            return { id: cachedId, exactMatch: true };
        }
    }

    // Fetch lists for this board
    const url = `https://api.trello.com/1/boards/${boardId}/lists?key=${credentials.apiKey}&token=${credentials.apiToken}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch lists: ${response.statusText}`);
    }

    const lists = await response.json();

    if (!Array.isArray(lists) || lists.length === 0) {
        throw new Error('No lists found on this board');
    }

    // Try exact match first (case-insensitive)
    const normalizedInput = listName.toLowerCase().trim();
    for (const list of lists) {
        if (list.name.toLowerCase().trim() === normalizedInput) {
            // Cache the result
            if (cache) {
                cache.setListId(boardId, listName, list.id);
            }
            return { id: list.id, exactMatch: true };
        }
    }

    // Try fuzzy match
    const listNames = lists.map((l: any) => l.name);
    const match = fuzzyMatch(listName, listNames);

    if (!match) {
        // Ambiguous - multiple similar matches
        const availableLists = listNames.join('\n  - ');
        throw new Error(
            `List "${listName}" not found. Multiple similar matches detected (e.g., "Dev" vs "Devs").\n\nPlease use exact name. Available lists:\n  - ${availableLists}`
        );
    }

    if (match.score < 0.8) {
        // No good match
        const availableLists = listNames.join('\n  - ');
        throw new Error(
            `List "${listName}" not found.\n\nDid you mean one of these?\n  - ${availableLists}`
        );
    }

    // Good fuzzy match found
    const matchedList = lists.find((l: any) => l.name === match.match);

    if (cache) {
        cache.setListId(boardId, listName, matchedList.id);
    }

    return { id: matchedList.id, exactMatch: false };
}

/**
 * Search for a card by name within a board using Trello Search API
 */
export async function resolveCardId(
    boardId: string,
    cardName: string,
    credentials: TrelloCredentials
): Promise<{ id: string; name: string }> {
    // Use Trello Search API for scalability
    const query = encodeURIComponent(`name:"${cardName}" idBoards:${boardId}`);
    const url = `https://api.trello.com/1/search?query=${query}&modelTypes=cards&cards_limit=10&key=${credentials.apiKey}&token=${credentials.apiToken}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to search for card: ${response.statusText}`);
    }

    const result = await response.json();
    const cards = result.cards || [];

    if (cards.length === 0) {
        return await resolveCardIdFromBoardListing(boardId, cardName, credentials);
    }

    if (cards.length === 1) {
        return { id: cards[0].id, name: cards[0].name };
    }

    // Multiple matches - try exact match first
    const normalizedInput = cardName.toLowerCase().trim();
    for (const card of cards) {
        if (card.name.toLowerCase().trim() === normalizedInput) {
            return { id: card.id, name: card.name };
        }
    }

    // No exact match - use first result (most relevant according to Trello)
    return { id: cards[0].id, name: cards[0].name };
}

async function resolveCardIdFromBoardListing(
    boardId: string,
    cardName: string,
    credentials: TrelloCredentials
): Promise<{ id: string; name: string }> {
    const url = new URL(`https://api.trello.com/1/boards/${boardId}/cards`);
    url.searchParams.append('key', credentials.apiKey);
    url.searchParams.append('token', credentials.apiToken);
    url.searchParams.append('filter', 'open');
    url.searchParams.append('fields', 'name,closed');

    const response = await fetch(url.toString());

    if (!response.ok) {
        throw new Error(
            `Card "${cardName}" not found using search, and fallback listing failed: ${response.statusText}`
        );
    }

    const cards = await response.json();

    if (!Array.isArray(cards) || cards.length === 0) {
        throw new Error(`Card "${cardName}" not found on this board (including fallback)`);
    }

    const normalizedInput = cardName.toLowerCase().trim();
    for (const card of cards) {
        if (card.name?.toLowerCase().trim() === normalizedInput) {
            return { id: card.id, name: card.name };
        }
    }

    const candidateNames = cards
        .map((card: any) => card.name)
        .filter((name: string | undefined) => typeof name === 'string') as string[];

    const match = fuzzyMatch(cardName, candidateNames);

    if (match && match.score >= 0.9) {
        const matchedCard = cards.find((card: any) => card.name === match.match);
        if (matchedCard) {
            return { id: matchedCard.id, name: matchedCard.name };
        }
    }

    throw new Error(`Card "${cardName}" not found on this board (after search + fallback)`);
}
