#!/bin/bash
rm -rf build dist *.spec
uv run pyinstaller --onefile --windowed --strip --name "FF14-P4-Calculator" main.py
