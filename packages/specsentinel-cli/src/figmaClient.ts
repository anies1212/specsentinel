import { GapSpec, PaddingSpec, ScreenSpec, TextSpec } from "./types";

export interface FigmaClientOptions {
  token: string;
}

interface FigmaNode {
  id: string;
  type: string;
  name?: string;
  children?: FigmaNode[];
  characters?: string;
  style?: { fontSize?: number };
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
}

interface FigmaNodesResponse {
  nodes: Record<
    string,
    {
      document: FigmaNode;
    }
  >;
}

export class FigmaClient {
  private token: string;

  constructor(opts: FigmaClientOptions) {
    this.token = opts.token;
  }

  async fetchScreenSpec(fileKey: string, nodeId: string, screenName?: string): Promise<ScreenSpec> {
    const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`;
    const res = await fetch(url, {
      headers: { "X-Figma-Token": this.token }
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Figma API error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as FigmaNodesResponse;
    const node = data.nodes[nodeId]?.document;
    if (!node) {
      throw new Error(`Node ${nodeId} not found in Figma response`);
    }

    const collectedTexts: TextSpec[] = [];
    const collectedPaddings: PaddingSpec[] = [];
    const collectedGaps: GapSpec[] = [];

    const visit = (n: FigmaNode) => {
      if (n.type === "TEXT") {
        collectedTexts.push({
          text: n.characters ?? null,
          fontSize: n.style?.fontSize ?? null
        });
      }

      if (typeof n.paddingLeft === "number") {
        collectedPaddings.push({
          left: n.paddingLeft ?? 0,
          top: n.paddingTop ?? 0,
          right: n.paddingRight ?? 0,
          bottom: n.paddingBottom ?? 0
        });
      }

      if (typeof n.itemSpacing === "number") {
        collectedGaps.push({
          height: n.itemSpacing ?? null,
          width: null
        });
      }

      if (n.children) {
        n.children.forEach(visit);
      }
    };

    visit(node);

    return {
      screenName: screenName ?? node.name ?? "Unknown",
      texts: collectedTexts,
      paddings: collectedPaddings,
      gaps: collectedGaps
    };
  }
}
