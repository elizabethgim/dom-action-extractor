from typing import Literal

from pydantic import BaseModel, Field

QuestionType = Literal["exact_value_lookup", "comparison", "hierarchical_reveal"]
StructuralComplexity = Literal["flat", "hierarchical"]
InteractionComplexity = Literal["low", "high"]
ReasoningComplexity = Literal["single_step", "multi_step"]


class BenchmarkEpisodeCreate(BaseModel):
    run_id: str = Field(alias="runId")
    answer: str
    question_type: QuestionType = Field(alias="questionType")
    structural_complexity: StructuralComplexity = Field(alias="structuralComplexity")
    interaction_complexity: InteractionComplexity = Field(alias="interactionComplexity")
    reasoning_complexity: ReasoningComplexity = Field(alias="reasoningComplexity")
    notes: str = ""


class BenchmarkEpisodeRead(BaseModel):
    id: str
    run_id: str = Field(alias="runId")
    answer: str
    question_type: QuestionType = Field(alias="questionType")
    structural_complexity: StructuralComplexity = Field(alias="structuralComplexity")
    interaction_complexity: InteractionComplexity = Field(alias="interactionComplexity")
    reasoning_complexity: ReasoningComplexity = Field(alias="reasoningComplexity")
    notes: str
    created_at: str = Field(alias="createdAt")
    chart_id: str = Field(alias="chartId")
    source: str
    family: str
    question_text: str = Field(alias="questionText")
    step_count: int = Field(alias="stepCount")
