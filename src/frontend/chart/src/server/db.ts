import { createClient } from '@clickhouse/client'

const CLICKHOUSE_HOST = process.env.CLICKHOUSE_HOST || 'localhost'
const CLICKHOUSE_PORT = process.env.CLICKHOUSE_PORT || '8123'

export const client = createClient({
    url: `http://${CLICKHOUSE_HOST}:${CLICKHOUSE_PORT}`,
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DB || 'ohlc_db',
})
