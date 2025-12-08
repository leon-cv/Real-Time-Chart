import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Chart } from '~/components/Chart'
import { fetchChartData } from '~/server/chart'
import { TIME_UNITS } from '~/shared/types'

const searchSchema = z.object({
    symbol: z.string().default('BTCUSDT'),
    tf_size: z.coerce.number().default(1),
    tf_unit: z.enum(TIME_UNITS).default('minute'),
})

export const Route = createFileRoute('/')({
    validateSearch: searchSchema,

    loaderDeps: ({ search }) => ({
        symbol: search.symbol,
        timeframeSize: search.tf_size,
        timeframeUnit: search.tf_unit,
    }),

    loader: async ({ context, deps }) => {
        return context.queryClient.ensureQueryData({
            queryKey: ['ohlc', deps.symbol, deps.timeframeSize, deps.timeframeUnit],
            queryFn: () => fetchChartData({
                symbol: deps.symbol,
                timeframeSize: deps.timeframeSize,
                timeframeUnit: deps.timeframeUnit,
            }),
        })
    },

    component: Home,
})

function Home() {
    return (
        <div className="p-4 bg-gray-900 min-h-screen text-white">
            <h1 className="text-2xl font-bold mb-4">Real-Time Chart</h1>
            <Chart />
        </div>
    )
}
