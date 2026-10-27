#!/usr/bin/env python3
"""Generate a small FIXI Windows icon without third-party dependencies.
Run before Tauri builds until the final brand artwork is added.
"""
from pathlib import Path
import struct
import zlib

SIZE=256
pixels=bytearray()
for y in range(SIZE):
    pixels.append(0)
    for x in range(SIZE):
        # Deep-blue rounded tile + white geometric F.
        radius=37
        in_tile=(radius<=x<SIZE-radius or radius<=y<SIZE-radius or
            (x-(radius if x<radius else SIZE-radius-1))**2+
            (y-(radius if y<radius else SIZE-radius-1))**2<=radius**2)
        white=(69<=x<=100 and 54<=y<=205) or (69<=x<=189 and 54<=y<=86) or (69<=x<=171 and 114<=y<=144)
        pixels.extend((247,250,255,255) if white and in_tile else (20,91,208,255) if in_tile else (0,0,0,0))
def chunk(kind,data):
    return struct.pack('!I',len(data))+kind+data+struct.pack('!I',zlib.crc32(kind+data)&0xffffffff)
raw=bytes(pixels)
png=(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',SIZE,SIZE,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))
icon=struct.pack('<HHH',0,1,1)+struct.pack('<BBBBHHII',0,0,0,0,1,32,len(png),22)+png
target=Path(__file__).resolve().parents[1]/'src-tauri'/'icons'/'icon.ico'
target.parent.mkdir(parents=True,exist_ok=True)
target.write_bytes(icon)
print('Generated',target,'(',len(icon),'bytes)')
