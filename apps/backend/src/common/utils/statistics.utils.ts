export const percentile = (
  values: Array<number | null | undefined>,
  ratio: number,
): number | null => {
  const sorted = values
    .filter((value): value is number => typeof value === 'number')
    .sort((a, b) => a - b);

  if (sorted.length === 0) return null;
  const index = Math.ceil(ratio * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
};

export const average = (values: Array<number | null | undefined>): number => {
  const valid = values.filter(
    (value): value is number => typeof value === 'number',
  );
  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};
