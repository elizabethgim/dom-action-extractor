from typing import Any

from pydantic import BaseModel, Field


class AiRunCreate(BaseModel):
    source: str
    family: str
    chart_id: str = Field(alias="chartId")
    selected_question_index: int = Field(default=0, alias="selectedQuestionIndex")
    question_text: str = Field(alias="questionText")
    stop_reason: str | None = Field(default=None, alias="stopReason")
    expected_answer: str | None = Field(default=None, alias="expectedAnswer")
    grade: str | None = Field(default=None, alias="grade")
    pipeline_variant: str = Field(default="baseline", alias="pipelineVariant")
    steps: list[dict[str, Any]]


class AiRunStep(BaseModel):
    step_index: int = Field(alias="stepIndex")
    payload: dict[str, Any]


class AiRunRead(BaseModel):
    id: str
    source: str
    family: str
    chart_id: str = Field(alias="chartId")
    run_id: str = Field(alias="runId")
    selected_question_index: int = Field(alias="selectedQuestionIndex")
    question_text: str = Field(alias="questionText")
    stop_reason: str | None = Field(alias="stopReason")
    expected_answer: str | None = Field(default=None, alias="expectedAnswer")
    grade: str | None = Field(default=None, alias="grade")
    pipeline_variant: str = Field(default="baseline", alias="pipelineVariant")
    created_at: str = Field(alias="createdAt")
    steps: list[AiRunStep]


class AiRunSummary(BaseModel):
    id: str
    source: str
    family: str
    chart_id: str = Field(alias="chartId")
    selected_question_index: int = Field(alias="selectedQuestionIndex")
    question_text: str = Field(alias="questionText")
    stop_reason: str | None = Field(alias="stopReason")
    expected_answer: str | None = Field(default=None, alias="expectedAnswer")
    grade: str | None = Field(default=None, alias="grade")
    pipeline_variant: str = Field(default="baseline", alias="pipelineVariant")
    created_at: str = Field(alias="createdAt")
    step_count: int = Field(alias="stepCount")
