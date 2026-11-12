from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import List


# Category rows used inside a create-screen request
class CategoryPayload(BaseModel):

    category_name: str = Field(min_length=1, max_length=50)

    price: float = Field(ge=0)

    color: str = Field(default="#3b82f6", pattern=r"^#[0-9a-fA-F]{6}$")


# One seat in the layout payload
class SeatPayload(BaseModel):

    seat_name: str = Field(min_length=1, max_length=10)

    row_number: int = Field(ge=1, le=52)

    column_number: int = Field(ge=1, le=40)

    category: str | None = None     # category_name, or None for default

    is_active: bool = True


# Layout metadata describing row labels, section gaps and aisles
class LayoutConfig(BaseModel):

    row_labels: List[str] = []

    column_labels: List[int] = []

    # List of gaps: each entry is the number of empty columns to insert
    # after that column position (e.g. [4] means 1 empty column after col 4)
    column_gaps: List[int] = []

    # List of row indexes after which a vertical gap is inserted
    row_gaps: List[int] = []

    # Optional section ranges, informational only
    sections: List[dict] = []


# Create screen request
class ScreenCreate(BaseModel):

    screen_name: str = Field(min_length=1, max_length=100)

    screen_number: int | None = Field(default=None, ge=1)

    no_of_rows: int = Field(ge=1, le=52)

    no_of_columns: int = Field(ge=1, le=40)

    has_categories: bool = False

    default_price: float | None = Field(default=None, ge=0)

    categories: List[CategoryPayload] = []

    seats: List[SeatPayload] = []

    layout_config: LayoutConfig = LayoutConfig()

    @field_validator("default_price")
    @classmethod
    def price_required_without_categories(cls, value, info):

        return value


class SeatBrief(BaseModel):

    model_config = ConfigDict(from_attributes=True)

    seat_id: int

    seat_name: str

    row_number: int

    column_number: int

    category_id: int | None = None

    category_name: str | None = None

    price: float | None = None

    is_active: bool


class CategoryBrief(BaseModel):

    model_config = ConfigDict(from_attributes=True)

    category_id: int

    category_name: str

    price: float

    color: str

    seat_count: int = 0


class ScreenResponse(BaseModel):

    model_config = ConfigDict(from_attributes=True)

    screen_id: int

    theatre_id: int

    screen_name: str

    screen_number: int | None = None

    no_of_rows: int

    no_of_columns: int

    has_categories: bool

    default_price: float | None = None

    status: str

    layout_config: dict | None = None

    seat_count: int = 0

    categories: List[CategoryBrief] = []

    seats: List[SeatBrief] = []


class ScreenBrief(BaseModel):

    model_config = ConfigDict(from_attributes=True)

    screen_id: int

    screen_name: str

    screen_number: int | None = None

    no_of_rows: int

    no_of_columns: int

    has_categories: bool

    default_price: float | None = None

    status: str

    seat_count: int = 0

    categories: List[CategoryBrief] = []
