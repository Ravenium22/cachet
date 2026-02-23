/**
 * Returns a human-readable relative time string, e.g. "2 hours ago", "3 days ago".
 * Falls back to a short date for anything older than 30 days.
 */
export function formatRelativeTime(dateInput: string | Date): string {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    const now = Date.now();
    const diffMs = now - date.getTime();

    if (diffMs < 0) return "just now";

    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return "just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;

    return formatShortDate(date);
}

/**
 * Formats a date as "Feb 22, 2026".
 */
export function formatShortDate(dateInput: string | Date): string {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}
