export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export const mean = (values: number[]) =>
  values.length ? values.reduce((acc, v) => acc + v, 0) / values.length : 0;

export const formatSigned = (n: number, digits = 1) => {
  const fixed = Math.abs(n).toFixed(digits);
  return `${n >= 0 ? "+" : "-"}${fixed}`;
};

export const toPercent = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;

export const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");
