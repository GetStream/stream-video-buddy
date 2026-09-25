function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  // Nearest-rank: with small samples this reports a value that was actually
  // observed, rather than an interpolation between two joins.
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  /* eslint-disable sort-keys -- ascending percentiles read better than alphabetical */
  return {
    count: sorted.length,
    min: sorted[0],
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1],
    mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
  };
  /* eslint-enable sort-keys */
}

function formatTable(rows) {
  const headers = Object.keys(rows[0]);
  const widths = headers.map((h) => Math.max(h.length, ...rows.map((r) => String(r[h]).length)));
  const line = (cells) => cells.map((c, i) => String(c).padStart(widths[i])).join('  ');
  return [
    line(headers),
    line(widths.map((w) => '-'.repeat(w))),
    ...rows.map((r) => line(headers.map((h) => r[h]))),
  ].join('\n');
}

module.exports = { formatTable, percentile, summarize };
