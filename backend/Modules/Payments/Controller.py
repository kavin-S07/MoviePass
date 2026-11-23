from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from Modules.Auth.Dependencies import get_token
from Modules.Bookings import Service as BookingService
from Modules.Bookings.Schema import CreatePaymentOrderRequest, CreatePaymentOrderResponse, PaymentStatusResponse, VerifyPaymentRequest
from config.database import get_db


router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("/create-order", response_model=CreatePaymentOrderResponse, status_code=status.HTTP_200_OK)
def create_order(
    payload: CreatePaymentOrderRequest,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return BookingService.create_payment_order_for_booking(db, token, payload.booking_id)


@router.post("/verify", response_model=PaymentStatusResponse, status_code=status.HTTP_200_OK)
def verify_payment(
    payload: VerifyPaymentRequest,
    db: Session = Depends(get_db),
    token: str = Depends(get_token),
):
    return BookingService.verify_payment_by_payload(db, token, payload)


