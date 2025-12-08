package collector

// Trade represents the standardized trade data structure we publish
type Trade struct {
	TradeID   string  `json:"trade_id"`
	TraderID  string  `json:"trader_id"`
	Symbol    string  `json:"symbol"`
	Price     float64 `json:"price"`
	Quantity  float64 `json:"quantity"`
	Volume    float64 `json:"volume"`
	Timestamp int64   `json:"timestamp"`
	Side      string  `json:"side"`
}

// BinanceTradeEvent represents the raw event from Binance WebSocket
type BinanceTradeEvent struct {
	EventType string `json:"e"`
	EventTime int64  `json:"E"`
	Symbol    string `json:"s"`
	TradeID   int64  `json:"t"`
	Price     string `json:"p"`
	Quantity  string `json:"q"`
	BuyerID   int64  `json:"b"`
	SellerID  int64  `json:"a"`
	TradeTime int64  `json:"T"`
	IsBuyerMM bool   `json:"m"`
	Ignore    bool   `json:"M"`
}
