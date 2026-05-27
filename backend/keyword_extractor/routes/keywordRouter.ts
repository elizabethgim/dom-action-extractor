import express, { type Request, type Response } from "express";

import { detectLanguage } from "../keywords/detectLanguage";
import { tokenize } from "../keywords/tokenize";
import { extractNumbers } from "../keywords/extractNumbers";
import { extractTimeHints } from "../keywords/extractTimeHints";
import { scoreKeywords } from "../keywords/scoreKeywords";
import { classify } from "../keywords/classify";

const router = express.Router();

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

export default router;
