from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    pulsar_service_url: str = "pulsar://localhost:6650"
    input_topic: str = "persistent://public/default/trades"
    output_topic: str = "persistent://public/default/ohlc-trades"
    subscription_name: str = "ohlc-aggregator-subscription"
    clickhouse_host: str = "clickhouse"
    clickhouse_port: int = 8123
    clickhouse_username: str
    clickhouse_password: str
    clickhouse_db: str = "ohlc_db"
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env.ohlc_aggregator")
