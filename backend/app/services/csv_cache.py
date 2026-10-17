from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from threading import RLock

import pandas as pd

from app.analytics.csv_loader import load_csv

MAX_CACHED_ITEMS = 2
MAX_CACHE_BYTES = 64 * 1024 * 1024


@dataclass
class CacheEntry:
    fingerprint: tuple[int, int, int, int, int]
    frame: pd.DataFrame
    size: int


_cache: OrderedDict[Path, CacheEntry] = OrderedDict()
_lock = RLock()


def _fingerprint(path: Path) -> tuple[int, int, int, int, int]:
    stat = path.stat()

    return (
        stat.st_dev,
        stat.st_ino,
        stat.st_size,
        stat.st_mtime_ns,
        stat.st_ctime_ns,
    )


def invalidate_cached_csv(path: Path) -> None:
    with _lock:
        _cache.pop(path, None)


def clear_csv_cache() -> None:
    with _lock:
        _cache.clear()


def load_cached_csv(path: Path) -> pd.DataFrame:
    try:
        fingerprint = _fingerprint(path)
    except OSError:
        invalidate_cached_csv(path)
        raise

    with _lock:
        cached = _cache.get(path)

        if cached is not None:
            if cached.fingerprint == fingerprint:
                _cache.move_to_end(path)
                return cached.frame.copy(deep=True)

            _cache.pop(path, None)

    # Parse outside the lock to avoid blocking other reads.
    frame = load_csv(path.read_bytes())

    # Do not cache data if the file changed during reading.
    if _fingerprint(path) != fingerprint:
        raise OSError("CSV changed during reading. Retry.")

    size = int(frame.memory_usage(deep=True).sum())

    if size > MAX_CACHE_BYTES or MAX_CACHED_ITEMS < 1:
        return frame

    with _lock:
        # Verify again before inserting into the cache.
        if _fingerprint(path) != fingerprint:
            raise OSError("CSV changed during caching. Retry.")

        _cache.pop(path, None)
        _cache[path] = CacheEntry(fingerprint, frame, size)

        while (
            len(_cache) > MAX_CACHED_ITEMS
            or sum(item.size for item in _cache.values())
            > MAX_CACHE_BYTES
        ):
            _cache.popitem(last=False)

    # Never expose the stored DataFrame to callers.
    return frame.copy(deep=True)
