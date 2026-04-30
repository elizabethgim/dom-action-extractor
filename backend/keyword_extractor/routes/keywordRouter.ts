// src/routes/keywords.ts
import express from "express";

import { detectLanguage, tokenize, extractNumbers, extractTimeHints, scoreKeywords, classify } from "../keywords/main";

const router = express.Router();

router.post("/keywords", express.json(), (req: Request, res: Response) => {
  const text = String(req.body?.text ?? "").trim();
  if (!text) return res.status(400).json({ error: "text is required" });

  const language = detectLanguage(text);
  const tokens = tokenize(text, language);

  const numbers = extractNumbers(text);
  const time = extractTimeHints(text);

  const kws = scoreKeywords(tokens, language).map(k => ({
    text: k.text,
    type: classify(k.text),
    score: k.score
  }));

  return res.json({
    language,
    keywords: kws,
    numbers,
    normalized: {
      time
    }
  });
});

export default router;