package collector

import (
	"context"
	"encoding/json"
	"log"

	"github.com/apache/pulsar-client-go/pulsar"
)

func StartPublishing(client pulsar.Client, topic string, trades <-chan Trade) {
	producer, err := client.CreateProducer(pulsar.ProducerOptions{
		Topic: topic,
	})
	if err != nil {
		log.Fatalf("Failed to create producer: %v", err)
	}
	defer producer.Close()

	log.Printf("Created producer for topic: %s", topic)

	for trade := range trades {
		payload, err := json.Marshal(trade)
		if err != nil {
			log.Printf("Failed to marshal trade: %v", err)
			continue
		}

		_, err = producer.Send(context.Background(), &pulsar.ProducerMessage{
			Payload: payload,
		})

		if err != nil {
			log.Printf("Failed to publish trade %s: %v", trade.TradeID, err)
		} else {
			// log.Printf("Trade published: %s", trade.TradeID)
		}
	}
}
