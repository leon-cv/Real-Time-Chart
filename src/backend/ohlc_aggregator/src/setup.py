from src.timeframes import TIMEFRAME_CONFIG


async def create_table_if_not_exists(client):
    await client.command(
        """
        CREATE TABLE IF NOT EXISTS ohlc_db.ohlc_table
        (
            symbol String,
            timeframe_size UInt32,
            timeframe_unit String,
            time UInt64,
            open Float64,
            high Float64,
            low Float64,
            close Float64
        )
        ENGINE = MergeTree()
        ORDER BY (symbol, time);
        """
    )

    for timeframe in TIMEFRAME_CONFIG:
        if timeframe.size == 1 and timeframe.unit.value == 'second':
            print("Skipping table and materialized view creation for 1-second timeframe.")
            continue

        table_name = f"ohlc_{timeframe.size}{timeframe.unit.value}"

        await client.command(
            f"""
            CREATE TABLE IF NOT EXISTS ohlc_db.{table_name}
            (
                symbol String,
                time UInt64,
                open AggregateFunction(argMin, Float64, UInt64),
                high AggregateFunction(max, Float64),
                low AggregateFunction(min, Float64),
                close AggregateFunction(argMax, Float64, UInt64)
            )
            ENGINE = MergeTree()
            ORDER BY (symbol, time)
            TTL fromUnixTimestamp(time) + INTERVAL {2 * timeframe.size} {timeframe.unit.value.upper()};
            """
        )

        print(f"Created table '{table_name}' for timeframe {timeframe.size}{timeframe.unit.value.upper()}.")

        mv_name = f"ohlc_{timeframe.size}{timeframe.unit.value}_mv"
        await client.command(
            f"""
            CREATE MATERIALIZED VIEW IF NOT EXISTS ohlc_db.{mv_name}
            TO ohlc_db.{table_name}
            AS SELECT
                symbol,
                CAST(
                    toUnixTimestamp(
                        toStartOfInterval(
                            fromUnixTimestamp(time),
                            INTERVAL {timeframe.size} {timeframe.unit.value.upper()}
                        )
                    ) AS UInt64
                ) AS time,
                argMinState(open, time) AS open,
                maxState(high) AS high,
                minState(low) AS low,
                argMaxState(close, time) AS close
            FROM ohlc_db.ohlc_table
            WHERE timeframe_size = 1
                AND timeframe_unit = 'second'
            GROUP BY symbol, time;
            """
        )

        print(f"Created materialized view '{mv_name}' for timeframe {timeframe.size}{timeframe.unit.value.upper()}.")
