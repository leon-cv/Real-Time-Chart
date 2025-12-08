package collector

import (
	"os"
)

type Config struct {
	PulsarServiceURL string
	OutputTopic      string
	BinanceWSURL     string
}

func LoadConfig() *Config {
	return &Config{
		PulsarServiceURL: getEnv("PULSAR_SERVICE_URL", "pulsar://pulsar:6650"),
		OutputTopic:      getEnv("OUTPUT_TOPIC", "persistent://public/default/trades"),
		BinanceWSURL:     getEnv("BINANCE_WS_URL", "wss://fstream.binance.com/ws/btcusdt@trade"),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
