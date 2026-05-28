import express, { type Request, type Response } from "express";

import { detectLanguage } from "../keywords/detectLanguage";
import { tokenize } from "../keywords/tokenize";
import { extractNumbers } from "../keywords/extractNumbers";
import { extractTimeHints } from "../keywords/extractTimeHints";
import { scoreKeywords } from "../keywords/scoreKeywords";
import { classify } from "../keywords/classify";

const router = express.Router();

const TYPE_TO_ACTION: Record<string, string> = {
  AGG_MAX: "hover",
  AGG_MIN: "hover",
  AGG_AVG: "hover",
  TIME: "zoom",
  TERM: "hover",
};

function extractKeywords(text: string) {
  const language = detectLanguage(text);
  const tokens = tokenize(text, language);
  return scoreKeywords(tokens, language).map((k: { text: string; score: number }) => ({
    text: k.text,
    type: classify(k.text),
    score: k.score,
  }));
}

router.post("/keywords", express.json(), (req: Request, res: Response) => {
  const text = String((req.body as { text?: string })?.text ?? "").trim();
  if (!text) {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const language = detectLanguage(text);
  const tokens = tokenize(text, language);
  const numbers = extractNumbers(text);
  const time = extractTimeHints(text);

  const kws = scoreKeywords(tokens, language).map((k: { text: string; score: number }) => ({
    text: k.text,
    type: classify(k.text),
    score: k.score,
  }));

  res.json({ language, keywords: kws, numbers, normalized: { time } });
});

type ActionDescriptor = {
  id: string;
  text: string;
  datum_name: string;
  action_type: string;
};

router.post("/rank-actions", express.json(), (req: Request, res: Response) => {
  const body = req.body as { question?: string; actions?: ActionDescriptor[]; top_k?: number };
  const question = String(body?.question ?? "").trim();
  const actions: ActionDescriptor[] = body?.actions ?? [];
  const topK = Number(body?.top_k ?? 30);

  if (!question || actions.length === 0) {
    res.status(400).json({ error: "question and actions are required" });
    return;
  }

  const kws = extractKeywords(question);
  const preferredActionType = kws.map(k => TYPE_TO_ACTION[k.type]).find(t => t != null);

  const scored = actions.map((action) => {
    let score = 0;
    const datumName = (action.datum_name ?? "").toLowerCase();
    const elemText = (action.text ?? "").toLowerCase();

    for (const k of kws) {
      const kText = k.text.toLowerCase();
      if (datumName && datumName.includes(kText)) {
        score += k.score * 2;
      } else if (elemText && elemText.includes(kText)) {
        score += k.score;
      }
    }

    if (preferredActionType && action.action_type === preferredActionType) score += 0.3;

    return { id: action.id, score };
  });

  const allZero = scored.every((s) => s.score === 0);
  const sorted = allZero
    ? scored  // 점수 없으면 원래 순서 유지
    : [...scored].sort((a, b) => b.score - a.score);

  const ranked = sorted.slice(0, topK);

  res.json({ ranked });
});

export default router;
