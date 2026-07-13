from lib import finance


def test_to_stooq_symbol():
    assert finance.to_stooq_symbol("AAPL") == "aapl.us"
    assert finance.to_stooq_symbol("^spx") == "^spx"
    assert finance.to_stooq_symbol("^SPX") == "^spx"
    assert finance.to_stooq_symbol("aapl.us") == "aapl.us"  # already qualified
    assert finance.to_stooq_symbol("  msft ") == "msft.us"
    assert finance.to_stooq_symbol("") == ""


_CSV = (
    "Symbol,Date,Time,Open,High,Low,Close,Volume\n"
    "AAPL.US,2026-07-13,22:00:05,100.0,105.0,99.0,102.0,50000000\n"
    "^SPX,2026-07-13,22:00:05,5000.0,5050.0,4990.0,4950.0,0\n"
)


def test_parse_quotes_maps_and_computes_change():
    rows = finance.parse_quotes(_CSV)
    assert len(rows) == 2
    aapl = rows[0]
    assert aapl["symbol"] == "AAPL"          # .US stripped, upper
    assert aapl["price"] == 102.0
    assert aapl["open"] == 100.0
    assert aapl["volume"] == 50000000
    assert aapl["change_pct"] == 2.0          # (102-100)/100*100
    spx = rows[1]
    assert spx["symbol"] == "^SPX"
    assert spx["change_pct"] == -1.0          # (4950-5000)/5000*100


def test_parse_quotes_defensive():
    assert finance.parse_quotes("") == []
    assert finance.parse_quotes("Symbol,Date,Time,Open,High,Low,Close,Volume\n") == []
    # N/D fields -> None, no raise; zero open -> change_pct None
    nd = ("Symbol,Date,Time,Open,High,Low,Close,Volume\n"
          "FOO.US,2026-07-13,22:00,N/D,N/D,N/D,N/D,N/D\n"
          "BAR.US,2026-07-13,22:00,0,1,0,1,10\n")
    rows = finance.parse_quotes(nd)
    assert rows[0]["price"] is None and rows[0]["change_pct"] is None
    assert rows[1]["change_pct"] is None      # open==0 guarded
    # short row skipped
    assert finance.parse_quotes("Symbol,Date\nX,Y\n") == []
