// src/app.ts
import express from "express";
import keywordsRouter from "./routes/keywordRouter";

const app = express();

app.use("/api", keywordsRouter);

app.listen(3000, () => console.log("listening on 3000"));
