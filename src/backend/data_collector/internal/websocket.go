package collector

import (
	"encoding/json"
	"log"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

func TradeStream(config *Config) <-chan Trade {
	ch := make(chan Trade)

	go func() {
		defer close(ch)

		for {
			connectAndStream(config, ch)
			log.Println("WebSocket disconnected. Reconnecting in 5 seconds...")
			time.Sleep(5 * time.Second)
		}
	}()

	return ch
}

func connectAndStream(config *Config, ch chan<- Trade) {
	conn, _, err := websocket.DefaultDialer.Dial(config.BinanceWSURL, nil)
	if err != nil {
		log.Printf("Failed to connect to WebSocket: %v", err)
		return
	}
	defer conn.Close()

	log.Printf("Connected to %s", config.BinanceWSURL)

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Read error: %v", err)
			return
		}

		var event BinanceTradeEvent
		if err := json.Unmarshal(message, &event); err != nil {
			log.Printf("Unmarshal error: %v", err)
			continue
		}

		// Convert to standardized Trade model
		price, _ := strconv.ParseFloat(event.Price, 64)
		quantity, _ := strconv.ParseFloat(event.Quantity, 64)

		side := "buy"
		if event.IsBuyerMM {
			side = "sell"
		}

		trade := Trade{
			TradeID:   strconv.FormatInt(event.TradeID, 10),
			TraderID:  uuid.New().String(),
			Symbol:    "BTCUSDT",
			Price:     price,
			Quantity:  quantity,
			Volume:    price * quantity,
			Timestamp: event.TradeTime,
			Side:      side,
		}

		ch <- trade
	}
}
