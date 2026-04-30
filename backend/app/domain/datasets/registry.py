import csv
from typing import Any

from app.core.settings import PROJECT_ROOT
from app.domain.datasets.schemas import DatasetDefinition, DatasetField

_EMPLOYMENT_CSV = (
    PROJECT_ROOT
    / "datasets/real-world/OurWorldData/employment"
    / "employment-in-agri-vs-urban-pop"
    / "employment-in-agri-vs-urban-pop.csv"
)

_CHILD_MORTALITY_CSV = (
    PROJECT_ROOT
    / "datasets/real-world/OurWorldData/child mortality"
    / "data"
    / "child-mortality.csv"
)

_COVID_CSV = (
    PROJECT_ROOT
    / "datasets/real-world/OurWorldData/covid"
    / "attempt2"
    / "daily-cases-covid-region.csv"
)


def _load_employment(year: int | None = None, **_: Any) -> dict[str, Any]:
    rows = []
    with open(_EMPLOYMENT_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            agri = row["Share of people employed in agricultural sector"]
            urban = row["Share of population living in urban areas"]
            if not agri or not urban:
                continue
            y = int(row["Year"])
            if year is not None and y != year:
                continue
            rows.append(
                {
                    "country": row["Entity"],
                    "code": row["Code"] or None,
                    "year": y,
                    "agriculture": float(agri),
                    "urban": float(urban),
                    "region": row["World region according to OWID"],
                }
            )
    return {
        "dataset_id": "employment",
        "title": "Employment in agriculture vs. urban population",
        "description": (
            "Share of total employment from the agricultural sector versus "
            "the share of population living in urban areas."
        ),
        "year": year,
        "row_count": len(rows),
        "rows": rows,
    }


def _load_child_mortality(**_: Any) -> dict[str, Any]:
    rows = []
    with open(_CHILD_MORTALITY_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rate = row["Under-five mortality rate (selected)"]
            if not rate:
                continue
            rows.append(
                {
                    "country": row["Entity"],
                    "code": row["Code"] or None,
                    "year": int(row["Year"]),
                    "mortality_rate": float(rate),
                }
            )
    return {
        "dataset_id": "child_mortality",
        "title": "Child Mortality",
        "description": "Under-five mortality rate per 1,000 live births.",
        "row_count": len(rows),
        "rows": rows,
    }


def _load_covid(**_: Any) -> dict[str, Any]:
    col = "Daily new confirmed cases due to COVID-19 (rolling 7-day average, right-aligned)"
    rows = []
    with open(_COVID_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            cases = row[col]
            rows.append(
                {
                    "country": row["Entity"],
                    "code": row["Code"] or None,
                    "day": row["Day"],
                    "cases": float(cases) if cases else None,
                }
            )
    return {
        "dataset_id": "covid",
        "title": "COVID Cases",
        "description": "Daily new confirmed COVID-19 cases (rolling 7-day average).",
        "row_count": len(rows),
        "rows": rows,
    }


DATASETS: dict[str, DatasetDefinition] = {
    "employment": DatasetDefinition(
        id="employment",
        title="Employment in agriculture vs. urban population",
        description=(
            "Share of total employment from the agricultural sector versus "
            "the share of population living in urban areas."
        ),
        fields=[
            DatasetField(name="country", type="string"),
            DatasetField(name="code", type="string"),
            DatasetField(name="year", type="number"),
            DatasetField(name="agriculture", type="number"),
            DatasetField(name="urban", type="number"),
            DatasetField(name="region", type="string"),
        ],
        load=_load_employment,
    ),
    "child_mortality": DatasetDefinition(
        id="child_mortality",
        title="Child Mortality",
        description="Under-five mortality rate per 1,000 live births.",
        fields=[
            DatasetField(name="country", type="string"),
            DatasetField(name="code", type="string"),
            DatasetField(name="year", type="number"),
            DatasetField(name="mortality_rate", type="number"),
        ],
        load=_load_child_mortality,
    ),
    "covid": DatasetDefinition(
        id="covid",
        title="COVID Cases",
        description="Daily new confirmed COVID-19 cases (rolling 7-day average).",
        fields=[
            DatasetField(name="country", type="string"),
            DatasetField(name="code", type="string"),
            DatasetField(name="day", type="string"),
            DatasetField(name="cases", type="number"),
        ],
        load=_load_covid,
    ),
}
