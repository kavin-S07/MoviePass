import hashlib
import hmac
import os
import secrets
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Dict


@dataclass
class PaymentOrder:
    provider: str
    provider_order_id: str
    amount: int  # smallest currency unit (paise for INR)
    currency: str
    key_id: str | None = None
    is_sandbox: bool = True
    metadata: Dict[str, Any] | None = None


class PaymentProviderError(Exception):
    pass


class BasePaymentProvider:
    provider_name = "base"
    is_sandbox = True

    def create_order(self, *, booking_reference: str, amount: Decimal, currency: str, notes: dict | None = None) -> PaymentOrder:
        raise NotImplementedError

    def verify_payment_signature(self, *, provider_order_id: str, provider_payment_id: str, signature: str) -> bool:
        raise NotImplementedError

    def fetch_payment(self, provider_payment_id: str) -> dict | None:
        """Optional server-side payment lookup. Returns provider payment dict or None."""
        return None


class SandboxPaymentProvider(BasePaymentProvider):
    """
    Isolated sandbox/test payment provider.
    - Generates deterministic verifiable signatures using a local secret.
    - Never contacts a real payment gateway and must not be represented as a real successful transaction.
    """

    provider_name = "sandbox"
    is_sandbox = True

    def __init__(self):
        self.secret = os.getenv("PAYMENT_SANDBOX_SECRET", "moviepass-sandbox-secret-change-me")
        self.key_id = os.getenv("PAYMENT_SANDBOX_KEY_ID", "sandbox_key")

    def _sign(self, message: str) -> str:
        return hmac.new(self.secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).hexdigest()

    def create_order(self, *, booking_reference: str, amount: Decimal, currency: str, notes: dict | None = None) -> PaymentOrder:
        provider_order_id = f"sandbox_order_{booking_reference}_{secrets.token_hex(6)}"
        amount_paise = int((amount * Decimal("100")).to_integral_value())
        return PaymentOrder(
            provider=self.provider_name,
            provider_order_id=provider_order_id,
            amount=amount_paise,
            currency=currency,
            key_id=self.key_id,
            is_sandbox=True,
            metadata={"notes": notes or {}, "sandbox": True},
        )

    def verify_payment_signature(self, *, provider_order_id: str, provider_payment_id: str, signature: str) -> bool:
        expected = self._sign(f"{provider_order_id}|{provider_payment_id}")
        return hmac.compare_digest(expected or "", signature or "")

    def make_client_signature(self, provider_order_id: str, provider_payment_id: str) -> str:
        """Helper for sandbox client/test flows only."""
        return self._sign(f"{provider_order_id}|{provider_payment_id}")


class RazorpayPaymentProvider(BasePaymentProvider):
    """Razorpay test/live provider using official razorpay Python SDK."""

    provider_name = "razorpay"
    is_sandbox = False

    def __init__(self):
        self.key_id = (os.getenv("RAZORPAY_KEY_ID") or "").strip()
        self.key_secret = (os.getenv("RAZORPAY_KEY_SECRET") or "").strip()
        self.environment = (os.getenv("RAZORPAY_ENVIRONMENT") or "test").strip().lower()

        if not self.key_id or not self.key_secret:
            raise PaymentProviderError("Razorpay credentials are not configured")

        try:
            import razorpay  # type: ignore
        except Exception as e:
            raise PaymentProviderError("Razorpay SDK is not installed") from e

        self.client = razorpay.Client(auth=(self.key_id, self.key_secret))
        # Razorpay test mode is still a real gateway integration (not the local sandbox provider).
        self.is_sandbox = False
        self.test_mode = self.environment != "live" or self.key_id.startswith("rzp_test")

    def create_order(self, *, booking_reference: str, amount: Decimal, currency: str, notes: dict | None = None) -> PaymentOrder:
        amount_paise = int((amount * Decimal("100")).to_integral_value())
        payload = {
            "amount": amount_paise,
            "currency": currency or "INR",
            "receipt": booking_reference[:40],
            "payment_capture": 1,
            "notes": notes or {},
        }
        try:
            order = self.client.order.create(data=payload)
        except Exception as e:
            raise PaymentProviderError("Failed to create Razorpay order") from e

        provider_order_id = str(order.get("id") or "")
        if not provider_order_id:
            raise PaymentProviderError("Razorpay order ID missing from provider response")

        return PaymentOrder(
            provider=self.provider_name,
            provider_order_id=provider_order_id,
            amount=int(order.get("amount") or amount_paise),
            currency=str(order.get("currency") or currency or "INR"),
            key_id=self.key_id,
            is_sandbox=self.is_sandbox,
            metadata={"razorpay_order": {"id": provider_order_id, "receipt": order.get("receipt"), "status": order.get("status")}, "notes": notes or {}},
        )

    def verify_payment_signature(self, *, provider_order_id: str, provider_payment_id: str, signature: str) -> bool:
        try:
            self.client.utility.verify_payment_signature({
                "razorpay_order_id": provider_order_id,
                "razorpay_payment_id": provider_payment_id,
                "razorpay_signature": signature,
            })
            return True
        except Exception:
            return False

    def fetch_payment(self, provider_payment_id: str) -> dict | None:
        try:
            payment = self.client.payment.fetch(provider_payment_id)
            return dict(payment) if payment else None
        except Exception:
            return None


def get_payment_provider() -> BasePaymentProvider:
    """
    Provider selection hook.
    - razorpay: uses official Razorpay SDK with RAZORPAY_* env vars (test mode expected).
    - sandbox/test/mock: isolated local sandbox provider.
    """
    provider = (os.getenv("PAYMENT_PROVIDER") or "sandbox").strip().lower()

    if provider == "razorpay":
        return RazorpayPaymentProvider()

    if provider in {"sandbox", "test", "mock", ""}:
        return SandboxPaymentProvider()

    # Unknown provider: fail safe to sandbox to avoid accidental real-payment behavior.
    return SandboxPaymentProvider()
