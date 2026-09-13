#!/usr/bin/env python3
"""Check 64-bit ELF load-segment alignment in an Android AAB or APK.

Usage: python3 scripts/verify-android-native.py path/to/app.aab
Checks the actual native libraries, not just the bundle's ZIP alignment setting.
See https://developer.android.com/guide/practices/page-sizes#elf-alignment
"""

import argparse
import json
import struct
import sys
import zipfile


def inspect_library(name, data):
    if data[:5] != b"\x7fELF\x02" or data[5] not in (1, 2):
        raise ValueError(f"{name}: expected a 64-bit ELF library")
    endian = "<" if data[5] == 1 else ">"
    offset = struct.unpack_from(endian + "Q", data, 32)[0]
    entry_size, count = struct.unpack_from(endian + "HH", data, 54)
    if entry_size < 56 or offset + entry_size * count > len(data):
        raise ValueError(f"{name}: invalid program header table")
    segments = []
    for index in range(count):
        header = offset + index * entry_size
        if struct.unpack_from(endian + "I", data, header)[0] == 1:  # PT_LOAD
            file_offset, virtual_address = struct.unpack_from(endian + "QQ", data, header + 8)
            alignment = struct.unpack_from(endian + "Q", data, header + 48)[0]
            segments.append({
                "alignment": alignment,
                "aligned": alignment >= 16384 and file_offset % 16384 == virtual_address % 16384,
            })
    return {"library": name, "segments": segments, "passed": bool(segments) and all(s["aligned"] for s in segments)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("artifact")
    parser.add_argument("--json", action="store_true", help="emit all inspected libraries as JSON")
    args = parser.parse_args()
    try:
        with zipfile.ZipFile(args.artifact) as archive:
            results = [
                inspect_library(name, archive.read(name))
                for name in archive.namelist()
                if name.endswith(".so") and any(f"lib/{abi}/" in name for abi in ("arm64-v8a", "x86_64"))
            ]
    except (OSError, ValueError, struct.error, zipfile.BadZipFile) as error:
        print(f"Native artifact inspection failed: {error}", file=sys.stderr)
        return 1
    failed = [result for result in results if not result["passed"]]
    if args.json:
        print(json.dumps({"artifact": args.artifact, "libraries": results}, indent=2))
    else:
        print(f"16 KB ELF alignment: {len(results) - len(failed)}/{len(results)} 64-bit libraries pass")
        for result in failed:
            print(f"FAIL {result['library']}")
    if not results:
        print("No 64-bit native libraries found; check the input artifact.", file=sys.stderr)
    return 1 if failed or not results else 0


if __name__ == "__main__":
    sys.exit(main())
