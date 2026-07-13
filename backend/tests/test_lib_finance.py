from lib import finance


def test_to_yahoo_symbol():
    assert finance.to_yahoo_symbol("aapl") == "AAPL"
    assert finance.to_yahoo_symbol("AAPL.US") == "AAPL"   # legacy Stooq suffix stripped
    assert finance.to_yahoo_symbol("^spx") == "^GSPC"     # alias
    assert finance.to_yahoo_symbol("^ndq") == "^IXIC"     # alias
    assert finance.to_yahoo_symbol("^GSPC") == "^GSPC"    # passthrough
    assert finance.to_yahoo_symbol("  msft ") == "MSFT"
    assert finance.to_yahoo_symbol("") == ""


_RESULT = {
    "meta": {
        "symbol": "AAPL", "shortName": "Apple Inc.",
        "regularMarketPrice": 102.0, "chartPreviousClose": 100.0,
        "regularMarketDayHigh": 105.0, "regularMarketDayLow": 99.0,
        "regularMarketVolume": 50000000,
    },
    "indicators": {"quote": [{"open": [None, 100.0]}]},
}


def test_parse_quote_maps_and_computes_change():
    q = finance.parse_quote(_RESULT)
    assert q["symbol"] == "AAPL"
    assert q["name"] == "Apple Inc."
    assert q["price"] == 102.0
    assert q["open"] == 100.0        # last non-null open
    assert q["high"] == 105.0 and q["low"] == 99.0
    assert q["volume"] == 50000000
    assert q["change_pct"] == 2.0    # (102-100)/100*100 vs prev close


def test_parse_quote_defensive():
    assert finance.parse_quote({}) is None
    assert finance.parse_quote({"meta": {}}) is None            # no symbol
    # missing price/prev -> change None, no raise
    q = finance.parse_quote({"meta": {"symbol": "FOO", "regularMarketPrice": None,
                                      "chartPreviousClose": None}})
    assert q["price"] is None and q["change_pct"] is None
    # zero prev close guarded
    q2 = finance.parse_quote({"meta": {"symbol": "BAR", "regularMarketPrice": 1,
                                       "chartPreviousClose": 0}})
    assert q2["change_pct"] is None
