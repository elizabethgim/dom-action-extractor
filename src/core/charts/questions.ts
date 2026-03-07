import type { ChartId } from "@core/charts/chartRegistry";

export function getQuestions(qId: ChartId): string[] {
  return questionRegistry[qId] ?? [];
}

const questionRegistry: Record<ChartId, string[]> = {
  "dataset:collapsible-tree" : ["What is the common ancesstor of S and J?", "What is the max depth of this tree?", "How many children nodes are there in node A?"] ,
  "observable:zoom-area" : ["How many flights were there in 1992 January to March?"],
  "dataset:multiple-line" : ["What is the exact value of Drag at December 21st?",
    "Which interaction type had the highest growth rate between Dec 2025 and Jan 2026?", 
    "What is the total sum of all interactions for the week of Jan 05?",
    "Are there any specific correlations between 'Hover' and 'Click' events in this dataset?"
  ],
  "observable:multiple-line": [""],
  "observable:index-line": ["What is the difference between Amazon and Gooogle stock price at 2018 January?"],
  "observable:bivariate-choropleth": [""],
  "dataset:mean-bar-chart": ["What is the average of B and C?"],
  "dataset:hierarchical-bar": ["What is the value of D?"],
  "csv:zoomable-sunburst": [
    "Which departament used the most health care service?",
    "Which sector receives the highest total budget?",
    "Which sector has the lowest funding?",
    "What is the difference in budget between Defense and Education?",
    "Which sector ranks second in total allocation?",
    "How much larger is Healthcare compared to Infrastructure?",
    "Within Education, which subcategory receives the most funding?",
    "In Healthcare, which area has the smallest allocation?",
    "Within Defense, how much is allocated to Personnel compared to Equipment?",
    "Which subcategory dominates Infrastructure spending?",
    "In Welfare, is Pension funding larger than Child Support?",
    "Within Education, which subcategory receives the most funding?",
    "In Healthcare, which area has the smallest allocation?",
    "Within Defense, how much is allocated to Personnel compared to Equipment?",
    "Which subcategory dominates Infrastructure spending?",
    "In Welfare, is Pension funding larger than Child Support?",
    "Which subcategory across all sectors has the highest allocation?",
    "What percentage of the total Education budget goes to Research?",
    "How does Mental Health funding compare to Primary Education funding?",
    "Which sector has the most evenly distributed subcategory budgets?",
    "Which subcategory contributes the least to its parent sector proportionally?",
    "Which sector has the largest gap between its highest and lowest subcategories?",
    "Among all subcategories, which one contributes the most to the overall national budget?",
    "If Research funding were doubled, would Education surpass Defense in total allocation?",
    "Which sector would experience the largest percentage decrease if its smallest subcategory were removed?",
    "Between Healthcare and Welfare, which sector relies more heavily on a single dominant subcategory?"
  ],
  "tableau:wall-e":[""]
}
