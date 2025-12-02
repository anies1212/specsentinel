export interface TextSpec {
  text: string | null;
  fontSize: number | null;
}

export interface PaddingSpec {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface GapSpec {
  height: number | null;
  width: number | null;
}

export interface ScreenSpec {
  screenName: string;
  texts: TextSpec[];
  paddings: PaddingSpec[];
  gaps: GapSpec[];
}

export interface DiffFinding {
  message: string;
}

export interface ComparisonResult {
  matches: boolean;
  diffs: DiffFinding[];
}
