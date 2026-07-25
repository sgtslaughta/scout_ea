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


def test_parse_quote_rejects_non_list_open():
    base_meta = {
        "symbol": "AAPL", "shortName": "Apple Inc.",
        "regularMarketPrice": 102.0, "chartPreviousClose": 100.0,
        "regularMarketDayHigh": 105.0, "regularMarketDayLow": 99.0,
        "regularMarketVolume": 50000000,
    }

    def make(open_value):
        return {"meta": base_meta, "indicators": {"quote": [{"open": open_value}]}}

    assert finance.parse_quote(make(5))["open"] is None
    assert finance.parse_quote(make(5.0))["open"] is None
    assert finance.parse_quote(make(True))["open"] is None
    assert finance.parse_quote(make("abc"))["open"] is None
    assert finance.parse_quote(make({"a": 1}))["open"] is None


def test_parse_history_extracts_close_series():
    result = {"indicators": {"quote": [{"close": [1.0, 2.5, 3.25]}]}}
    assert finance.parse_history(result) == [1.0, 2.5, 3.25]


def test_parse_history_drops_nulls():
    result = {"indicators": {"quote": [{"close": [1.0, None, 3.0, None]}]}}
    assert finance.parse_history(result) == [1.0, 3.0]


def test_parse_history_handles_unusable_input():
    assert finance.parse_history({}) == []
    assert finance.parse_history(None) == []
    assert finance.parse_history({"indicators": {}}) == []
    assert finance.parse_history({"indicators": {"quote": []}}) == []


def test_parse_history_coerces_ints_and_skips_junk():
    result = {"indicators": {"quote": [{"close": [1, "bad", 3.5]}]}}
    assert finance.parse_history(result) == [1.0, 3.5]


def test_parse_history_rejects_non_list_close():
    assert finance.parse_history({"indicators": {"quote": [{"close": 5}]}}) == []
    assert finance.parse_history({"indicators": {"quote": [{"close": 5.0}]}}) == []
    assert finance.parse_history({"indicators": {"quote": [{"close": True}]}}) == []
    assert finance.parse_history({"indicators": {"quote": [{"close": "abc"}]}}) == []
    assert finance.parse_history({"indicators": {"quote": [{"close": {"a": 1}}]}}) == []
