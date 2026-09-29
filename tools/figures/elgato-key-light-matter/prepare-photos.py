#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "numpy", "opencv-python-headless"]
# ///
"""Conventional edits only. Inputs: desk PNG, controller PNG, output directory.

Convert HEIC inputs to PNG with sips first. Coordinates are normalized to a
1824px source width. Originals remain untouched. Final post assets are encoded
and stripped of metadata using `bun run post image`.
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps


def load(path):
    return np.asarray(ImageOps.exif_transpose(Image.open(path)).convert("RGB"))


def grade(pixels, gains, gamma):
    # Modest white balance and lifted shadows, without local reconstruction.
    values = pixels.astype(np.float32) / 255
    values = np.clip(values * np.array(gains), 0, 1)
    return np.uint8(np.clip(np.power(values, gamma) * 255, 0, 255))


def crop(pixels, box):
    factor = pixels.shape[1] / 1824
    left, top, right, bottom = (round(value * factor) for value in box)
    return pixels[top:bottom, left:right]


desk_path, board_path, destination = sys.argv[1:]
out = Path(destination)
out.mkdir(parents=True, exist_ok=True)

# Correct mild camera roll while preserving the real warm emission of the lamps.
desk = load(desk_path)
height, width = desk.shape[:2]
matrix = cv2.getRotationMatrix2D((width / 2, height / 2), 0.65, 1)
desk = cv2.warpAffine(desk, matrix, (width, height), flags=cv2.INTER_CUBIC)
desk = crop(desk, (180, 270, 1725, 1135))
desk = grade(desk, (0.985, 1.0, 1.025), 0.98)
Image.fromarray(desk).save(out / "desk.png")

# Rectify the slight taper of the main board. Warp pixels, never synthesize
# traces or text. The blue controller, wires and PCA remain in the crop.
board = load(board_path)
height, width = board.shape[:2]
factor = width / 1824
source = np.float32([(130, 80), (1268, 80), (1276, 1150), (66, 1150)]) * factor
target = np.float32([(110, 80), (1270, 80), (1270, 1150), (110, 1150)]) * factor
matrix = cv2.getPerspectiveTransform(source, target)
board = cv2.warpPerspective(board, matrix, (width, height), flags=cv2.INTER_CUBIC)
board = crop(board, (0, 275, 1390, 1160))
board = grade(board, (0.98, 1.0, 1.025), 0.94)
Image.fromarray(board).save(out / "controller.png")
