#!/usr/bin/env python3
"""Exercise an already-open dense map on a dedicated Android QA emulator.

Example: python3 scripts/qa-map-stress.py --serial emulator-5556 --output /tmp/map-qa.json
Navigate to Napa/Sonoma first. This pans the screen and records partial evidence
on failure; it cannot certify visual responsiveness, recenter, layers or billing.
"""
import argparse
import json
import re
import subprocess
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--serial', required=True, help='Dedicated QA emulator serial')
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--adb', default=str(Path.home() / 'Library/Android/sdk/platform-tools/adb'))
    parser.add_argument('--duration', type=int, default=300)
    args = parser.parse_args()
    if not args.serial.startswith('emulator-') or args.duration < 15:
        parser.error('Use a dedicated emulator and a duration of at least 15 seconds')
    package = 'com.nicholashorton.corkandnote'
    started = time.monotonic()
    report = dict(serial=args.serial, requestedSeconds=args.duration, status='running',
                  samples=[], panGestures=0, physicalDevice=False, playSigningVerified=False,
                  visualAcceptanceRequired=True)

    def adb(*command):
        return subprocess.run([args.adb, '-s', args.serial, *command], check=True,
                              capture_output=True, timeout=20).stdout.decode()

    def save():
        report['elapsedSeconds'] = round(time.monotonic() - started, 1)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        temporary = args.output.with_suffix(args.output.suffix + '.tmp')
        temporary.write_text(json.dumps(report, indent=2) + '\n')
        temporary.replace(args.output)

    save()
    try:
        pid = adb('shell', 'pidof', package).strip()
        if not pid:
            raise RuntimeError('App is not running')
        iteration = 0
        while time.monotonic() - started < args.duration:
            for coordinates in [('300', '850', '720', '1050'), ('720', '1050', '300', '850')]:
                adb('shell', 'input', 'swipe', *coordinates, '750')
                report['panGestures'] += 1
                time.sleep(1)
            memory = adb('shell', 'dumpsys', 'meminfo', package)
            match = re.search(r'TOTAL PSS:\s+(\d+).*TOTAL RSS:\s+(\d+).*TOTAL SWAP PSS:\s+(\d+)', memory)
            sample = dict(seconds=round(time.monotonic() - started, 1),
                          sameProcess=adb('shell', 'pidof', package).strip() == pid)
            if match:
                sample.update(zip(('pssKb', 'rssKb', 'swapPssKb'), map(int, match.groups())))
            report['samples'].append(sample)
            save()
            if not sample['sameProcess']:
                raise RuntimeError('App process changed')
            print(json.dumps(sample), flush=True)
            iteration += 1
            time.sleep(max(0, min(args.duration, iteration * 15) - (time.monotonic() - started)))
        report['status'] = 'completed; manual visual and log review required'
    except (subprocess.SubprocessError, OSError, RuntimeError, KeyboardInterrupt) as error:
        # Keep command output out of the receipt; logs can contain account data.
        report['status'] = 'incomplete'
        report['failureType'] = type(error).__name__
    finally:
        save()
    return 0 if report['status'].startswith('completed') else 1


if __name__ == '__main__':
    raise SystemExit(main())
