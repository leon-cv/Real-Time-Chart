
export function normalizeToSeconds(ts: number | string): number {
    const n = typeof ts === "string" ? Number(ts) : ts;
    if (n > 1e12) return Math.floor(n / 1000);
    return Math.floor(n);
}
