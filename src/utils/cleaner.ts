/**
 * Data Transformation Layer for Trello API Responses
 * 
 * This module strips UI noise from Trello API responses to reduce token consumption
 * and provide clean, semantic data to LLM agents.
 */

export interface CleanBoard {
    id: string;
    name: string;
    desc: string;
    url: string;
    lists?: CleanList[];
}

export interface CleanList {
    id: string;
    name: string;
    closed: boolean;
    cards?: CleanCard[];
}

export interface CleanCard {
    id: string;
    name: string;
    desc: string;
    due: string | null;
    labels: string[];
    members: string[];
    checklistStatus: string;
    url: string;
    closed: boolean;
}

/**
 * Build a member ID to name lookup map from board members
 */
export function buildMemberMap(board: any): Map<string, string> {
    const memberMap = new Map<string, string>();

    if (!board.members || !Array.isArray(board.members)) {
        return memberMap;
    }

    for (const member of board.members) {
        if (member.id && member.fullName) {
            memberMap.set(member.id, member.fullName);
        }
    }

    return memberMap;
}

/**
 * Calculate checklist completion status
 */
function calculateChecklistStatus(checklists: any[]): string {
    if (!checklists || checklists.length === 0) {
        return '0/0';
    }

    let totalItems = 0;
    let completedItems = 0;

    for (const checklist of checklists) {
        if (checklist.checkItems && Array.isArray(checklist.checkItems)) {
            totalItems += checklist.checkItems.length;
            completedItems += checklist.checkItems.filter((item: any) => item.state === 'complete').length;
        }
    }

    return `${completedItems}/${totalItems}`;
}

/**
 * Clean a single card, resolving IDs to names
 */
export function cleanCard(card: any, memberMap?: Map<string, string>, labelMap?: Map<string, string>): CleanCard {
    // Resolve member IDs to names
    const members: string[] = [];
    if (card.idMembers && Array.isArray(card.idMembers) && memberMap) {
        for (const memberId of card.idMembers) {
            const memberName = memberMap.get(memberId);
            if (memberName) {
                members.push(memberName);
            }
        }
    }

    // Resolve label IDs to names (or use label objects if available)
    const labels: string[] = [];
    if (card.labels && Array.isArray(card.labels)) {
        for (const label of card.labels) {
            if (typeof label === 'string' && labelMap) {
                // Label is an ID, resolve it
                const labelName = labelMap.get(label);
                if (labelName) {
                    labels.push(labelName);
                }
            } else if (label.name) {
                // Label is an object with name
                labels.push(label.name);
            }
        }
    }

    // Calculate checklist status
    const checklistStatus = calculateChecklistStatus(card.checklists || []);

    return {
        id: card.id,
        name: card.name || '',
        desc: card.desc || '',
        due: card.due || null,
        labels,
        members,
        checklistStatus,
        url: card.url || card.shortUrl || '',
        closed: card.closed || false,
    };
}

/**
 * Clean a single list
 */
export function cleanList(list: any, memberMap?: Map<string, string>, labelMap?: Map<string, string>): CleanList {
    const cleanedList: CleanList = {
        id: list.id,
        name: list.name || '',
        closed: list.closed || false,
    };

    // Clean cards if present
    if (list.cards && Array.isArray(list.cards)) {
        cleanedList.cards = list.cards.map((card: any) => cleanCard(card, memberMap, labelMap));
    }

    return cleanedList;
}

/**
 * Build a label ID to name lookup map from board labels
 */
export function buildLabelMap(board: any): Map<string, string> {
    const labelMap = new Map<string, string>();

    if (!board.labels || !Array.isArray(board.labels)) {
        return labelMap;
    }

    for (const label of board.labels) {
        if (label.id && label.name) {
            labelMap.set(label.id, label.name);
        }
    }

    return labelMap;
}

/**
 * Clean a board with all its lists and cards
 */
export function cleanBoard(board: any): CleanBoard {
    // Build lookup maps
    const memberMap = buildMemberMap(board);
    const labelMap = buildLabelMap(board);

    const cleanedBoard: CleanBoard = {
        id: board.id,
        name: board.name || '',
        desc: board.desc || '',
        url: board.url || board.shortUrl || '',
    };

    // Clean lists if present
    if (board.lists && Array.isArray(board.lists)) {
        cleanedBoard.lists = board.lists.map((list: any) => cleanList(list, memberMap, labelMap));
    }

    return cleanedBoard;
}

/**
 * Main cleaning function - automatically detects type and cleans accordingly
 */
export function cleanTrelloResponse(data: any): any {
    if (!data) {
        return data;
    }

    // Handle arrays
    if (Array.isArray(data)) {
        // Detect type from first element
        if (data.length > 0) {
            const firstItem = data[0];
            if (firstItem.lists !== undefined || firstItem.prefs !== undefined) {
                // Array of boards
                return data.map(cleanBoard);
            } else if (firstItem.cards !== undefined) {
                // Array of lists
                return data.map((list: any) => cleanList(list));
            } else if (firstItem.idList !== undefined || firstItem.badges !== undefined) {
                // Array of cards
                return data.map((card: any) => cleanCard(card));
            }
        }
        return data;
    }

    // Handle single objects
    if (data.lists !== undefined || data.prefs !== undefined) {
        // Single board
        return cleanBoard(data);
    } else if (data.cards !== undefined) {
        // Single list
        return cleanList(data);
    } else if (data.idList !== undefined || data.badges !== undefined) {
        // Single card
        return cleanCard(data);
    }

    // Unknown type, return as-is
    return data;
}
