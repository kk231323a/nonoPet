"""
Find numeric WeChat emoticon-seed candidates in Weixin.exe memory.

This intentionally returns only digit candidates. It does not inspect or emit
chat text, contacts, credentials, or other process data.

The Windows memory-scanning approach is adapted from the MIT-licensed project
Circumsized/Wechat-Emoticon-Export.
"""

from __future__ import annotations

import ctypes
import ctypes.wintypes as wt
import json
import re
import subprocess


MEM_COMMIT = 0x1000
MEM_PRIVATE = 0x20000
MAX_REGION = 200 * 1024 * 1024
CHUNK = 8 * 1024 * 1024
READABLE = {2, 4, 8, 16, 32, 64, 128}
WRITABLE = {0x04, 0x08, 0x40}
SEED_PATTERN = re.compile(rb"(?<![0-9])(\d{8,12})(?![0-9])")


class MemoryInfo(ctypes.Structure):
    _fields_ = [
        ("BaseAddress", ctypes.c_uint64),
        ("AllocationBase", ctypes.c_uint64),
        ("AllocationProtect", wt.DWORD),
        ("_pad1", wt.DWORD),
        ("RegionSize", ctypes.c_uint64),
        ("State", wt.DWORD),
        ("Protect", wt.DWORD),
        ("Type", wt.DWORD),
        ("_pad2", wt.DWORD),
    ]


kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
kernel32.OpenProcess.argtypes = [wt.DWORD, wt.BOOL, wt.DWORD]
kernel32.OpenProcess.restype = wt.HANDLE
kernel32.ReadProcessMemory.argtypes = [
    wt.HANDLE,
    ctypes.c_uint64,
    ctypes.c_void_p,
    ctypes.c_size_t,
    ctypes.POINTER(ctypes.c_size_t),
]
kernel32.ReadProcessMemory.restype = wt.BOOL
kernel32.VirtualQueryEx.argtypes = [
    wt.HANDLE,
    ctypes.c_uint64,
    ctypes.POINTER(MemoryInfo),
    ctypes.c_size_t,
]
kernel32.VirtualQueryEx.restype = ctypes.c_size_t
kernel32.CloseHandle.argtypes = [wt.HANDLE]
kernel32.CloseHandle.restype = wt.BOOL


def weixin_pids() -> list[int]:
    result = subprocess.run(
        [
            "tasklist",
            "/FI",
            "IMAGENAME eq Weixin.exe",
            "/FO",
            "CSV",
            "/NH",
        ],
        capture_output=True,
        text=True,
        creationflags=subprocess.CREATE_NO_WINDOW,
        check=False,
    )
    pids: list[int] = []
    for line in result.stdout.splitlines():
        cells = [cell.strip('"') for cell in line.split('","')]
        if len(cells) >= 2 and cells[1].isdigit():
            pids.append(int(cells[1]))
    return pids


def readable_writable_regions(handle: int) -> list[tuple[int, int]]:
    regions: list[tuple[int, int]] = []
    address = 0
    info = MemoryInfo()
    while address < 0x7FFFFFFFFFFF:
        queried = kernel32.VirtualQueryEx(
            handle,
            address,
            ctypes.byref(info),
            ctypes.sizeof(info),
        )
        if not queried:
            break
        is_candidate = (
            info.State == MEM_COMMIT
            and info.Type == MEM_PRIVATE
            and info.Protect in READABLE
            and info.Protect in WRITABLE
            and 0 < info.RegionSize <= MAX_REGION
        )
        if is_candidate:
            regions.append((info.BaseAddress, info.RegionSize))
        next_address = info.BaseAddress + info.RegionSize
        if next_address <= address:
            break
        address = next_address
    return regions


def scan_process(handle: int) -> set[int]:
    seeds: set[int] = set()
    for base, size in readable_writable_regions(handle):
        offset = 0
        tail = b""
        while offset < size:
            current_size = min(CHUNK, size - offset)
            buffer = ctypes.create_string_buffer(current_size)
            bytes_read = ctypes.c_size_t(0)
            ok = kernel32.ReadProcessMemory(
                handle,
                base + offset,
                buffer,
                current_size,
                ctypes.byref(bytes_read),
            )
            if ok:
                data = tail + buffer.raw[: bytes_read.value]
                for match in SEED_PATTERN.finditer(data):
                    value = int(match.group(0))
                    if 100_000_000 < value < 4_000_000_000:
                        seeds.add(value)
                tail = data[-64:]
            else:
                tail = b""
            offset += current_size
    return seeds


def main() -> None:
    all_seeds: set[int] = set()
    for pid in weixin_pids():
        handle = kernel32.OpenProcess(0x0410, False, pid)
        if not handle:
            continue
        try:
            all_seeds.update(scan_process(handle))
        finally:
            kernel32.CloseHandle(handle)
    print(json.dumps(sorted(all_seeds)))


if __name__ == "__main__":
    main()
