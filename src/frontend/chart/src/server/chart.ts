import { createServerFn } from '@tanstack/react-start'
import { client } from './db'
import { ohlcParamsSchema, CandlestickData, OHLCParams } from '~/shared/types'

async function fetchOHLC(params: OHLCParams): Promise<CandlestickData[]> {
  const { symbol, timeframeSize, timeframeUnit } = ohlcParamsSchema.parse(params)

  try {
    const resultSet = await client.query({
      query: `
              SELECT
                toUnixTimestamp(fromUnixTimestamp(time)) as time,
                open,
                high,
                low,
                close
              FROM ohlc_db.ohlc_table
              WHERE symbol = {symbol:String}
                AND timeframe_size = {size:UInt32}
                AND timeframe_unit = {unit:String}
              ORDER BY time ASC
            `,
      query_params: {
        symbol,
        size: timeframeSize,
        unit: timeframeUnit
      },
      format: 'JSONEachRow',
    })

    const rows = await resultSet.json<CandlestickData>()
    return rows
  } catch (e) {
    console.error("ClickHouse Query Error:", e)
    throw e
  }
}

export const getOHLC = createServerFn({ method: "GET" })
  .handler(async (ctx) => {
    return fetchOHLC(ctx.data as unknown as OHLCParams)
  })

export async function fetchChartData(params: OHLCParams): Promise<CandlestickData[]> {
  const fn = getOHLC as unknown as (opts: { data: OHLCParams }) => Promise<CandlestickData[]>
  return fn({ data: params })
}

interface FormingCandleOHL {
  open: number
  high: number
  low: number
  close: number | null
  periodStart: number
}

async function fetchFormingCandleOHL(params: OHLCParams): Promise<FormingCandleOHL | null> {
  const { symbol, timeframeSize, timeframeUnit } = ohlcParamsSchema.parse(params)

  const unitToSeconds: Record<string, number> = {
    second: 1,
    minute: 60,
    hour: 3600,
    day: 86400,
  }

  const timeframeSeconds = timeframeSize * unitToSeconds[timeframeUnit]
  const now = Math.floor(Date.now() / 1000)
  const currentPeriodStart = Math.floor(now / timeframeSeconds) * timeframeSeconds

  try {
    const result = await client.query({
      query: `
        WITH period_data AS (
          SELECT 
            time,
            open,
            high,
            low,
            close,
            ROW_NUMBER() OVER (ORDER BY time ASC) as rn_asc,
            ROW_NUMBER() OVER (ORDER BY time DESC) as rn_desc
          FROM ohlc_db.ohlc_table
          WHERE symbol = {symbol:String}
            AND timeframe_size = 1
            AND timeframe_unit = 'second'
            AND time >= {start:UInt32}
            AND time < {end:UInt32}
        )
        SELECT
          any(open) FILTER (WHERE rn_asc = 1) as first_open,
          max(high) as max_high,
          min(low) as min_low,
          any(close) FILTER (WHERE rn_desc = 1) as last_close,
          count() as data_count
        FROM period_data
      `,
      query_params: {
        symbol,
        start: currentPeriodStart,
        end: currentPeriodStart + timeframeSeconds
      },
      format: "JSONEachRow",
    })

    const rows = await result.json<{
      first_open: number | null
      max_high: number | null
      min_low: number | null
      last_close: number | null
      data_count: string
    }>()

    const row = rows[0]
    const count = parseInt(row?.data_count || "0")

    if (count === 0 || !row?.first_open) {
      console.debug(`[Server] No 1s data in period ${currentPeriodStart} for ${symbol}`)
      return null
    }

    console.debug(`[Server] Forming candle for ${symbol}`, {
      periodStart: currentPeriodStart,
      open: row.first_open,
      high: row.max_high,
      low: row.min_low,
      close: row.last_close,
      dataPoints: count,
    })

    return {
      open: row.first_open,
      high: row.max_high!,
      low: row.min_low!,
      close: row.last_close,
      periodStart: currentPeriodStart,
    }

  } catch (e) {
    console.error("ClickHouse Query Error (forming candle):", e)
    return null
  }
}

export const getFormingCandleOHL = createServerFn({ method: "GET" })
  .handler(async (ctx) => {
    return fetchFormingCandleOHL(ctx.data as unknown as OHLCParams)
  })

export async function fetchFormingCandle(params: OHLCParams): Promise<FormingCandleOHL | null> {
  const fn = getFormingCandleOHL as unknown as (opts: { data: OHLCParams }) => Promise<FormingCandleOHL | null>
  return fn({ data: params })
}