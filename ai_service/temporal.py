"""Exploratory adjacent-frame motion measurements, not a forgery classifier."""
import cv2
import numpy as np


def analyze_pair(first_bgr, second_bgr):
    """Measure dense flow and local unexplained change after motion compensation."""
    if first_bgr.shape != second_bgr.shape or first_bgr.ndim != 3 or first_bgr.shape[2] != 3:
        raise ValueError("Temporal frames must have equal BGR dimensions")
    first = cv2.cvtColor(first_bgr, cv2.COLOR_BGR2GRAY)
    second = cv2.cvtColor(second_bgr, cv2.COLOR_BGR2GRAY)
    forward = cv2.calcOpticalFlowFarneback(first, second, None, 0.5, 3, 15, 3, 5, 1.2, 0)
    backward = cv2.calcOpticalFlowFarneback(second, first, None, 0.5, 3, 15, 3, 5, 1.2, 0)
    height, width = first.shape
    x, y = np.meshgrid(np.arange(width, dtype=np.float32), np.arange(height, dtype=np.float32))
    map_x = x + forward[..., 0]
    map_y = y + forward[..., 1]
    valid = (map_x >= 0) & (map_x < width - 1) & (map_y >= 0) & (map_y < height - 1)
    warped_second = cv2.remap(second, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    warped_backward = cv2.remap(backward, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    magnitude = np.linalg.norm(forward, axis=2)
    round_trip = np.linalg.norm(forward + warped_backward, axis=2)
    residual = cv2.absdiff(first, warped_second)
    if not np.any(valid):
        raise ValueError("No valid temporal pixels")
    # A small high-residual region is visible without turning it into a calibrated anomaly score.
    tile = max(16, min(height, width) // 8)
    local_means = [float(residual[row:row + tile, col:col + tile][valid[row:row + tile, col:col + tile]].mean())
                   for row in range(0, height - tile + 1, tile)
                   for col in range(0, width - tile + 1, tile)
                   if valid[row:row + tile, col:col + tile].mean() >= 0.8]
    return {"scope": "adjacent_original_frames", "method": "farneback_forward_backward_v1",
            "medianFlowPixels": round(float(np.median(magnitude[valid])), 4),
            "p95FlowPixels": round(float(np.percentile(magnitude[valid], 95)), 4),
            "meanRoundTripErrorPixels": round(float(round_trip[valid].mean()), 4),
            "meanMotionCompensatedResidual": round(float(residual[valid].mean()), 4),
            "maxTileResidual": round(max(local_means) if local_means else float(residual[valid].mean()), 4),
            "validPixelFraction": round(float(valid.mean()), 4)}
