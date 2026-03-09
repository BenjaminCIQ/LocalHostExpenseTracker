from app.ml.preprocessor import preprocess_text, build_features


def test_preprocess_lowercases_strips_digits_and_punct():
    text = "SEPA-LASTSCHRIFT Spotify AB 4829174!!"
    out = preprocess_text(text)
    assert out == out.lower()
    assert "4829174" not in out
    assert "spotify" in out


def test_preprocess_unicode_normalization():
    text = "Müller & Söhne"
    out = preprocess_text(text)
    assert "muller" in out
    assert "sohne" in out


def test_build_features_combines_merchant_and_description():
    f = build_features("Bought groceries at REWE", "REWE")
    assert "rewe" in f
    assert "groceries" in f


def test_build_features_omits_operator_merchant():
    f = build_features("PAYPAL *ACME STORE", "PAYPAL")
    assert "paypal" not in f
    assert "acme" in f

