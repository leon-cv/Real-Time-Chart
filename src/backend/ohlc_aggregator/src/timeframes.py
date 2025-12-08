from src.time_window import TimeUnit, TimeWindow

TIMEFRAME_CONFIG = [
    TimeWindow(size, unit)
    for unit, sizes in {
        TimeUnit.SECOND: [1, 5, 10, 15, 30, 45],
        TimeUnit.MINUTE: [1, 2, 3, 5, 10, 15, 30, 45],
        TimeUnit.HOUR: [1, 2, 4, 6, 8, 12],
        TimeUnit.DAY: [1, 2, 3],
        TimeUnit.WEEK: [1, 2],
        TimeUnit.MONTH: [1, 2, 3, 6],
        TimeUnit.YEAR: [1, 2, 3, 5],
    }.items()
    for size in sizes
]

ONLY_SECONDS = [
    TimeWindow(size, TimeUnit.SECOND) for size in [1, 5, 10, 15, 30, 45]
]
