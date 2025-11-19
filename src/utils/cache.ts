/**
 * Caching Layer for Trello MCP Server
 * 
 * Provides in-memory caching with TTL to reduce redundant API calls.
 * Board and list IDs are relatively static, making them ideal for caching.
 */

interface CacheEntry<T> {
    value: T;
    timestamp: number;
}

export class TrelloCache {
    private boardNameToId: Map<string, CacheEntry<string>>;
    private listsByBoard: Map<string, Map<string, CacheEntry<string>>>;
    private ttlMs: number;

    /**
     * Create a new cache instance
     * @param ttlMinutes Time-to-live in minutes (default: 5)
     */
    constructor(ttlMinutes: number = 5) {
        this.boardNameToId = new Map();
        this.listsByBoard = new Map();
        this.ttlMs = ttlMinutes * 60 * 1000;
    }

    /**
     * Check if a cache entry is still valid
     */
    private isValid<T>(entry: CacheEntry<T> | undefined): boolean {
        if (!entry) {
            return false;
        }
        const age = Date.now() - entry.timestamp;
        return age < this.ttlMs;
    }

    /**
     * Get board ID from cache by board name
     */
    getBoardId(boardName: string): string | null {
        const normalizedName = boardName.toLowerCase().trim();
        const entry = this.boardNameToId.get(normalizedName);

        if (this.isValid(entry)) {
            return entry!.value;
        }

        // Entry expired, remove it
        if (entry) {
            this.boardNameToId.delete(normalizedName);
        }

        return null;
    }

    /**
     * Set board ID in cache
     */
    setBoardId(boardName: string, boardId: string): void {
        const normalizedName = boardName.toLowerCase().trim();
        this.boardNameToId.set(normalizedName, {
            value: boardId,
            timestamp: Date.now(),
        });
    }

    /**
     * Get list ID from cache by board ID and list name
     */
    getListId(boardId: string, listName: string): string | null {
        const normalizedName = listName.toLowerCase().trim();
        const boardLists = this.listsByBoard.get(boardId);

        if (!boardLists) {
            return null;
        }

        const entry = boardLists.get(normalizedName);

        if (this.isValid(entry)) {
            return entry!.value;
        }

        // Entry expired, remove it
        if (entry) {
            boardLists.delete(normalizedName);
        }

        return null;
    }

    /**
     * Set list ID in cache
     */
    setListId(boardId: string, listName: string, listId: string): void {
        const normalizedName = listName.toLowerCase().trim();

        // Get or create board's list map
        let boardLists = this.listsByBoard.get(boardId);
        if (!boardLists) {
            boardLists = new Map();
            this.listsByBoard.set(boardId, boardLists);
        }

        boardLists.set(normalizedName, {
            value: listId,
            timestamp: Date.now(),
        });
    }

    /**
     * Invalidate all cached data for a specific board
     */
    invalidateBoard(boardId: string): void {
        this.listsByBoard.delete(boardId);

        // Also remove board name mapping if we can find it
        for (const [name, entry] of this.boardNameToId.entries()) {
            if (entry.value === boardId) {
                this.boardNameToId.delete(name);
                break;
            }
        }
    }

    /**
     * Clear all cached data
     */
    clear(): void {
        this.boardNameToId.clear();
        this.listsByBoard.clear();
    }

    /**
     * Get cache statistics for debugging
     */
    getStats(): { boards: number; lists: number } {
        let totalLists = 0;
        for (const boardLists of this.listsByBoard.values()) {
            totalLists += boardLists.size;
        }

        return {
            boards: this.boardNameToId.size,
            lists: totalLists,
        };
    }
}
