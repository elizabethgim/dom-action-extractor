from pydantic import BaseModel

class ChartCodeCreate(BaseModel):
    title: str
    html_code: str = ""
    css_code: str = ""
    js_code: str = ""

class ChartCodeRead(ChartCodeCreate):
    id: int

