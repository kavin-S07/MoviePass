import hashlib
import hmac
import json
import os
import secrets
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Dict


@dataclass
class PaymentOrder:
    provider: str
    provider_order_id: str
    amount: int  # smallest currency unit for provider compatibility if needed
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

    def verify_webhook_signature(self, *, payload_body: bytes, signature: str | None) -> bool:
        raise NotImplementedError

    def parse_webhook_event(self, *, payload_body: bytes) -> dict:
        try:
            return json.loads(payload_body.decode("utf-8") or "{}")
        except Exception:
            return {}


class SandboxPaymentProvider(BasePaymentProvider):
    """
    Isolated sandbox/test payment provider.
    - Generates deterministic verifiable signatures using a local secret.
    - Never contacts a real payment gateway and must not be represented as a real successful transaction.
    - Intended only for development/test when no live provider credentials are configured.
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

    def verify_webhook_signature(self, *, payload_body: bytes, signature: str | None) -> bool:
        expected = self._sign(payload_body.decode("utf-8"))
        return hmac.compare_digest(expected or "", signature or "")

    def make_client_signature(self, provider_order_id: str, provider_payment_id: str) -> str:
        """Helper for sandbox client/test flows only."""
        return self._sign(f"{provider_order_id}|{provider_payment_id}")

    def make_webhook_signature(self, payload_body: bytes) -> str:
        """Helper for sandbox webhook/test flows only."""
        return self._sign(payload_body.decode("utf-8"))


def get_payment_provider() -> BasePaymentProvider:
    """
    Provider abstraction hook. Real providers (e.g. Razorpay) can be added behind this interface
    without rewriting booking logic, subject to explicit configuration and credentials.
    No real provider credentials are configured in this repository environment by default,
    so the isolated sandbox provider is returned.
    """
    provider = (os.getenv("PAYMENT_PROVIDER") or "sandbox").strip().lower()
    # Razorpay/live providers intentionally not enabled without explicit secure server-side integration.
    if provider in {"sandbox", "test", "mock", ""}:
        return SandboxPaymentProvider()
    # Fallback to sandbox to avoid accidental real-payment behavior without implementation/credentials.
    return SandboxPaymentProvider()
