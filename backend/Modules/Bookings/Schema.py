from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class SeatAvailabilityItem(BaseModel):
    seat_id: int
    seat_name: str
    row_number: int
    column_number: int
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    category_price: Optional[float] = None
    category_color: Optional[str] = None
    is_active: bool
    availability_status: str  # AVAILABLE, BOOKED, LOCKED, LOCKED_BY_YOU, UNAVAILABLE, INACTIVE


class SeatCategoryInfo(BaseModel):
    category_id: int
    category_name: str
    price: float
    color: str
    seat_count: int = 0


class ShowSeatLayoutResponse(BaseModel):
    show_id: int
    screen_id: int
    theatre_id: int
    screen_name: str
    no_of_rows: int
    no_of_columns: int
    layout_config: Optional[dict] = None
    categories: List[SeatCategoryInfo] = Field(default_factory=list)
    seats: List[SeatAvailabilityItem] = Field(default_factory=list)


class LockSeatsRequest(BaseModel):
    seat_ids: List[int] = Field(min_length=1, max_length=20)


class LockedSeatInfo(BaseModel):
    seat_id: int
    seat_name: str
    category_name: Optional[str] = None
    price: float


class LockSeatsResponse(BaseModel):
    show_id: int
    lock_token: str
    lock_status: str
    locked_at: datetime
    expires_at: datetime
    expires_in_seconds: int
    seats: List[LockedSeatInfo]
    subtotal: float
    currency: str = "INR"


class ReleaseSeatLocksRequest(BaseModel):
    lock_token: Optional[str] = Field(default=None, max_length=64)
    seat_ids: Optional[List[int]] = None


class ReleaseSeatLocksResponse(BaseModel):
    show_id: int
    released_count: int
    lock_token: Optional[str] = None
    status: str = "RELEASED"


class BookingSeatSummary(BaseModel):
    seat_id: int
    seat_name: str
    category_name: Optional[str] = None
    price: float


class BookingSummaryResponse(BaseModel):
    show_id: int
    movie_name: Optional[str] = None
    theatre_name: Optional[str] = None
    theatre_address: Optional[str] = None
    theatre_city: Optional[str] = None
    screen_name: Optional[str] = None
    show_date: Any = None
    start_time: Any = None
    end_time: Any = None
    lock_token: str
    lock_expires_at: datetime
    seats: List[BookingSeatSummary] = Field(default_factory=list)
    ticket_subtotal: float
    tax_amount: float
    convenience_fee: float
    total_payable_amount: float
    currency: str = "INR"
    pricing_note: str = "All amounts are calculated and validated by the backend."


class CreateBookingRequest(BaseModel):
    lock_token: str = Field(min_length=8, max_length=128)


class PaymentInfo(BaseModel):
    payment_id: int
    provider: str
    provider_order_id: Optional[str] = None
    amount: float
    currency: str
    payment_status: str
    is_sandbox: bool = True


class BookingCheckoutResponse(BaseModel):
    booking_id: int
    booking_reference: str
    booking_status: str
    user_id: int
    show_id: int
    lock_token: str
    ticket_subtotal: float
    tax_amount: float
    convenience_fee: float
    total_payable_amount: float
    currency: str = "INR"
    seats: List[BookingSeatSummary] = Field(default_factory=list)
    payment: PaymentInfo


class VerifyPaymentRequest(BaseModel):
    provider_payment_id: str = Field(min_length=3, max_length=120)
    signature: str = Field(min_length=3, max_length=256)


class PaymentStatusResponse(BaseModel):
    booking_id: int
    booking_reference: str
    booking_status: str
    payment_status: str
    payment_id: Optional[int] = None
    provider: Optional[str] = None
    provider_order_id: Optional[str] = None
    provider_payment_id: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    is_sandbox: bool = True
    message: Optional[str] = None


class BookingStatusResponse(BaseModel):
    booking_id: int
    booking_reference: str
    booking_status: str
    show_id: int
    ticket_subtotal: float
    tax_amount: float
    convenience_fee: float
    total_payable_amount: float
    currency: str
    lock_expires_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    payment: Optional[PaymentInfo] = None
    seats: List[BookingSeatSummary] = Field(default_factory=list)


class SandboxHelpersResponse(BaseModel):
    provider: str
    is_sandbox: bool
    provider_order_id: str
    sandbox_payment_id: str
    sandbox_signature: str
    webhook_signature_for_event: Optional[str] = None
    warning: str


class TicketInfo(BaseModel):
    ticket_id: int
    ticket_reference: str
    qr_code_identifier: str
    ticket_status: str
    issued_at: datetime
    booking_id: int
    booking_reference: str
    movie_name: Optional[str] = None
    movie_poster: Optional[str] = None
    theatre_name: Optional[str] = None
    theatre_address: Optional[str] = None
    screen_name: Optional[str] = None
    show_date: Any = None
    show_time: Any = None
    seat_numbers: List[str] = Field(default_factory=list)
    total_amount: float
    currency: str = "INR"
    booking_confirmation_status: str


class BookingListItem(BaseModel):
    booking_id: int
    booking_reference: str
    booking_status: str
    movie_name: Optional[str] = None
    movie_poster: Optional[str] = None
    theatre_name: Optional[str] = None
    screen_name: Optional[str] = None
    show_date: Any = None
    show_time: Any = None
    seat_numbers: List[str] = Field(default_factory=list)
    total_amount: float
    currency: str = "INR"
    booking_date: Optional[datetime] = None
    created_at: Optional[datetime] = None
    ticket_status: Optional[str] = None
    has_ticket: bool = False
    refund_status: Optional[str] = None


class MyBookingsResponse(BaseModel):
    upcoming: List[BookingListItem] = Field(default_factory=list)
    past: List[BookingListItem] = Field(default_factory=list)
    cancelled: List[BookingListItem] = Field(default_factory=list)


class BookingDetailResponse(BaseModel):
    booking_id: int
    booking_reference: str
    booking_status: str
    booking_date: Optional[datetime] = None
    movie_name: Optional[str] = None
    movie_poster: Optional[str] = None
    theatre_name: Optional[str] = None
    theatre_address: Optional[str] = None
    theatre_city: Optional[str] = None
    screen_name: Optional[str] = None
    show_date: Any = None
    show_time: Any = None
    start_time: Any = None
    end_time: Any = None
    seats: List[BookingSeatSummary] = Field(default_factory=list)
    seat_numbers: List[str] = Field(default_factory=list)
    ticket_subtotal: float
    tax_amount: float
    convenience_fee: float
    total_amount: float
    currency: str = "INR"
    payment_status: Optional[str] = None
    refund_status: Optional[str] = None
    ticket: Optional[TicketInfo] = None


class TicketResponse(BaseModel):
    booking_id: int
    booking_reference: str
    ticket: TicketInfo


class VerifyTicketRequest(BaseModel):
    qr_code_identifier: Optional[str] = Field(default=None, min_length=8, max_length=200)
    ticket_reference: Optional[str] = Field(default=None, min_length=4, max_length=80)
    redeem: bool = False


class VerifyTicketResponse(BaseModel):
    valid: bool
    status: str
    message: str
    redeemed: bool = False
    ticket_reference: Optional[str] = None
    booking_reference: Optional[str] = None
    show_date: Any = None
    show_time: Any = None
    seat_numbers: List[str] = Field(default_factory=list)
    movie_name: Optional[str] = None
    theatre_name: Optional[str] = None
    screen_name: Optional[str] = None
