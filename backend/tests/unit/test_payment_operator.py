from app.services.payment_operator import detect_payment_operator, is_payment_operator_merchant


def test_detect_payment_operator_paypal():
    assert detect_payment_operator("PAYPAL *XYZ", None) == "PAYPAL"


def test_detect_payment_operator_stripe():
    assert detect_payment_operator("Stripe", "Payment STRIPE.COM") == "STRIPE"


def test_is_payment_operator_merchant():
    assert is_payment_operator_merchant("SUMUP") is True
    assert is_payment_operator_merchant("REWE") is False

