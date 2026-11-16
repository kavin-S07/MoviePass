from fastapi import APIRouter, Depends, Header, Request, status
from sqlalchemy.orm import Session

from Modules.Auth.Dependencies import get_token
from Modules.Bookings import Service
from Modules.Bookings.Schema import (
    BookingCheckoutResponse,
    BookingDetailResponse,
    BookingStatusResponse,
    BookingSummaryResponse,
    CreateBookingRequest,
    LockSeatsRequest,
    LockSeatsResponse,
    MyBookingsResponse,
    PaymentStatusResponse,
    ReleaseSeatLocksRequest,
    ReleaseSeatLocksResponse,
    SandboxHelpersResponse,
    ShowSeatLayoutResponse,
    TicketResponse,
    VerifyPaymentRequest,
    VerifyTicketRequest,
    VerifyTicketResponse,
)
from config.database import get_db

router = APIRouter(prefix="/bookings", tags=["Bookings & Tickets"])


@router.post("/payments/webhook", status_code=status.HTTP_200_OK)
async def payment_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_payment_signature: str | None = Header(default=None, alias="X-Payment-Signature"),
):
    body = await request.body()
    return Service.handle_payment_webhook(db, body, x_payment_signature)


@router.post("/tickets/verify", response_model=VerifyTicketResponse, status_code=status.HTTP_200_OK)
def verify_ticket(
    payload: VerifyTicketRequest,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.verify_ticket(db, token, payload)


@router.get("/shows/{show_id}/seats", response_model=ShowSeatLayoutResponse, status_code=status.HTTP_200_OK)
def get_show_seat_availability(
    show_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.get_show_seat_availability(db, token, show_id)


@router.post("/shows/{show_id}/locks", response_model=LockSeatsResponse, status_code=status.HTTP_201_CREATED)
def lock_show_seats(
    show_id: int,
    payload: LockSeatsRequest,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.lock_seats(db, token, show_id, payload)


@router.post("/shows/{show_id}/locks/release", response_model=ReleaseSeatLocksResponse, status_code=status.HTTP_200_OK)
def release_show_seat_locks(
    show_id: int,
    payload: ReleaseSeatLocksRequest | None = None,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.release_seat_locks(db, token, show_id, payload)


@router.get("/summary", response_model=BookingSummaryResponse, status_code=status.HTTP_200_OK)
def get_booking_summary(
    lock_token: str,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.get_booking_summary(db, token, lock_token)


@router.post("/checkout", response_model=BookingCheckoutResponse, status_code=status.HTTP_201_CREATED)
def create_booking_checkout(
    payload: CreateBookingRequest,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.checkout_create_booking(db, token, payload)


@router.get("/my", response_model=MyBookingsResponse, status_code=status.HTTP_200_OK)
def list_my_bookings(
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.list_my_bookings(db, token)


@router.get("/{booking_id}/details", response_model=BookingDetailResponse, status_code=status.HTTP_200_OK)
def get_booking_details(
    booking_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.get_booking_details_for_owner(db, token, booking_id)


@router.get("/{booking_id}/ticket", response_model=TicketResponse, status_code=status.HTTP_200_OK)
def get_or_generate_ticket(
    booking_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.get_or_generate_ticket_for_owner(db, token, booking_id)


@router.get("/{booking_id}/ticket/download", response_model=TicketResponse, status_code=status.HTTP_200_OK)
def download_ticket_data(
    booking_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.get_ticket_download_data(db, token, booking_id)


@router.post("/{booking_id}/payments/verify", response_model=PaymentStatusResponse, status_code=status.HTTP_200_OK)
def verify_booking_payment(
    booking_id: int,
    payload: VerifyPaymentRequest,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.verify_payment(db, token, booking_id, payload)


@router.post("/{booking_id}/payments/retry", response_model=PaymentStatusResponse, status_code=status.HTTP_200_OK)
def retry_booking_payment(
    booking_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.retry_payment(db, token, booking_id)


@router.get("/{booking_id}/payments/sandbox/helpers", response_model=SandboxHelpersResponse, status_code=status.HTTP_200_OK)
def sandbox_payment_helpers(
    booking_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.get_sandbox_payment_helpers(db, token, booking_id)


@router.get("/{booking_id}", response_model=BookingStatusResponse, status_code=status.HTTP_200_OK)
def get_booking_status(
    booking_id: int,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return Service.get_booking_status(db, token, booking_id)
