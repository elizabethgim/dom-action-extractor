// src/app.ts
import express from "express";
import keywordsRouter from "./routes/keywordRouter";

const app = express();

app.use("/", keywordsRouter);

app.listen(5001, () => console.log("keyword extractor listening on 5001"));
