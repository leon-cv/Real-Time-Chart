package main

import (
	"log"
	"time"

	collector "data_collector_go/internal"

	"github.com/apache/pulsar-client-go/pulsar"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lmicroseconds)

	config := collector.LoadConfig()

	client, err := pulsar.NewClient(pulsar.ClientOptions{
		URL:               config.PulsarServiceURL,
		OperationTimeout:  30 * time.Second,
		ConnectionTimeout: 30 * time.Second,
	})
	if err != nil {
		log.Fatalf("Could not instantiate Pulsar client: %v", err)
	}
	defer client.Close()

	log.Println("Pulsar client initializing...")

	tradesCh := collector.TradeStream(config)

	collector.StartPublishing(client, config.OutputTopic, tradesCh)
}
