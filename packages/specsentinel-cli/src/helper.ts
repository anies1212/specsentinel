export const toSnake = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();

export const numberFrom = (input: string | undefined): number | null => {
  if (!input) return null;
  const n = Number(input.trim());
  return Number.isFinite(n) ? n : null;
};
