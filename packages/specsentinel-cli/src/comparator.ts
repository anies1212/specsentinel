import { ComparisonResult, GapSpec, PaddingSpec, ScreenSpec, TextSpec } from "./types";

const nearlyEqual = (a: number | null, b: number | null, tolerance = 0): boolean => {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= tolerance;
};

const compareText = (expected: TextSpec[], actual: TextSpec[], diffs: string[]) => {
  expected.forEach((exp, idx) => {
    const act = actual[idx];
    if (!act) {
      diffs.push(`Text #${idx}: missing in actual`);
      return;
    }

    if (exp.text !== act.text) {
      diffs.push(`Text #${idx}: text mismatch expected="${exp.text}" actual="${act.text}"`);
    }
    if (!nearlyEqual(exp.fontSize, act.fontSize)) {
      diffs.push(`Text #${idx} ("${exp.text}"): fontSize expected=${exp.fontSize} actual=${act.fontSize}`);
    }
  });
};

const comparePadding = (expected: PaddingSpec[], actual: PaddingSpec[], diffs: string[]) => {
  expected.forEach((exp, idx) => {
    const act = actual[idx];
    if (!act) {
      diffs.push(`Padding #${idx}: missing in actual`);
      return;
    }

    (["left", "top", "right", "bottom"] as const).forEach((key) => {
      if (exp[key] !== act[key]) {
        diffs.push(`Padding #${idx}: ${key} expected=${exp[key]} actual=${act[key]}`);
      }
    });
  });
};

const compareGap = (expected: GapSpec[], actual: GapSpec[], diffs: string[]) => {
  expected.forEach((exp, idx) => {
    const act = actual[idx];
    if (!act) {
      diffs.push(`Gap #${idx}: missing in actual`);
      return;
    }

    (["height", "width"] as const).forEach((key) => {
      if (!nearlyEqual(exp[key], act[key])) {
        diffs.push(`Gap #${idx}: ${key} expected=${exp[key]} actual=${act[key]}`);
      }
    });
  });
};

export const compareScreenSpec = (expected: ScreenSpec, actual: ScreenSpec): ComparisonResult => {
  const diffs: string[] = [];

  if (expected.screenName !== actual.screenName) {
    diffs.push(`screenName expected="${expected.screenName}" actual="${actual.screenName}"`);
  }

  compareText(expected.texts, actual.texts, diffs);
  comparePadding(expected.paddings, actual.paddings, diffs);
  compareGap(expected.gaps, actual.gaps, diffs);

  return { matches: diffs.length === 0, diffs: diffs.map((message) => ({ message })) };
};
