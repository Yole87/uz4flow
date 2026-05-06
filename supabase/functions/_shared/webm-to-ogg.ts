/**
 * Lightweight WebM-to-OGG Opus remuxer.
 * Extracts raw Opus packets from a WebM (EBML) container and re-wraps them
 * into an OGG container with proper OpusHead/OpusTags headers (RFC 7845).
 * No re-encoding — audio quality is preserved perfectly.
 */

// ─── CRC32 for OGG pages ───────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256);
(function buildCrcTable() {
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) {
      r = (r & 0x80000000) ? ((r << 1) ^ 0x04C11DB7) : (r << 1);
    }
    CRC_TABLE[i] = r >>> 0;
  }
})();

function oggCrc32(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ data[i]) & 0xFF]) >>> 0;
  }
  return crc;
}

// ─── OGG page builder ──────────────────────────────────────────────────────
function buildOggPage(
  serialNumber: number,
  pageSequence: number,
  granulePosition: bigint,
  headerType: number,
  packets: Uint8Array[],
): Uint8Array {
  // Build segment table
  const segmentSizes: number[] = [];
  for (const pkt of packets) {
    let remaining = pkt.length;
    while (remaining >= 255) {
      segmentSizes.push(255);
      remaining -= 255;
    }
    segmentSizes.push(remaining); // Final segment (0-254) marks end of packet
  }

  const totalDataLen = packets.reduce((s, p) => s + p.length, 0);
  const headerLen = 27 + segmentSizes.length;
  const page = new Uint8Array(headerLen + totalDataLen);
  const view = new DataView(page.buffer);

  // Capture pattern "OggS"
  page[0] = 0x4F; page[1] = 0x67; page[2] = 0x67; page[3] = 0x53;
  // Version
  page[4] = 0;
  // Header type
  page[5] = headerType;
  // Granule position (little-endian 64-bit)
  view.setUint32(6, Number(granulePosition & 0xFFFFFFFFn), true);
  view.setUint32(10, Number((granulePosition >> 32n) & 0xFFFFFFFFn), true);
  // Serial number
  view.setUint32(14, serialNumber, true);
  // Page sequence number
  view.setUint32(18, pageSequence, true);
  // CRC placeholder (filled after)
  view.setUint32(22, 0, true);
  // Number of segments
  page[26] = segmentSizes.length;
  // Segment table
  for (let i = 0; i < segmentSizes.length; i++) {
    page[27 + i] = segmentSizes[i];
  }
  // Data
  let offset = headerLen;
  for (const pkt of packets) {
    page.set(pkt, offset);
    offset += pkt.length;
  }

  // CRC32
  const crc = oggCrc32(page);
  view.setUint32(22, crc, true);

  return page;
}

// ─── EBML / WebM parser (minimal) ──────────────────────────────────────────
function readVint(data: Uint8Array, pos: number): { value: number; length: number } | null {
  if (pos >= data.length) return null;
  const first = data[pos];
  if (first === 0) return null;

  let len = 1;
  let mask = 0x80;
  while (len <= 8 && !(first & mask)) {
    len++;
    mask >>= 1;
  }
  if (len > 8 || pos + len > data.length) return null;

  let value = first & (mask - 1);
  for (let i = 1; i < len; i++) {
    value = (value * 256) + data[pos + i];
  }
  return { value, length: len };
}

function readElementId(data: Uint8Array, pos: number): { id: number; length: number } | null {
  if (pos >= data.length) return null;
  const first = data[pos];
  if (first === 0) return null;

  let len = 1;
  if (first >= 0x80) len = 1;
  else if (first >= 0x40) len = 2;
  else if (first >= 0x20) len = 3;
  else if (first >= 0x10) len = 4;
  else return null;

  if (pos + len > data.length) return null;

  let id = first;
  for (let i = 1; i < len; i++) {
    id = (id * 256) + data[pos + i];
  }
  return { id, length: len };
}

// Known EBML element IDs
const EBML_ID = 0x1A45DFA3;
const SEGMENT_ID = 0x18538067;
const TRACKS_ID = 0x1654AE6B;
const TRACK_ENTRY_ID = 0xAE;
const CODEC_PRIVATE_ID = 0x63A2;
const CLUSTER_ID = 0x1F43B675;
const SIMPLE_BLOCK_ID = 0xA3;
const BLOCK_GROUP_ID = 0xA0;
const BLOCK_ID = 0xA1;
const TIMECODE_ID = 0xE7; // Cluster Timestamp
const TIMESTAMP_SCALE_ID = 0x2AD7B1;
const INFO_ID = 0x1549A966;

// Master elements that contain children
const MASTER_IDS = new Set([
  EBML_ID, SEGMENT_ID, TRACKS_ID, TRACK_ENTRY_ID,
  CLUSTER_ID, BLOCK_GROUP_ID, INFO_ID,
]);

interface OpusPacket {
  data: Uint8Array;
  timestampMs: number;
}

function extractOpusPackets(webm: Uint8Array): { codecPrivate: Uint8Array | null; packets: OpusPacket[] } {
  let codecPrivate: Uint8Array | null = null;
  const packets: OpusPacket[] = [];
  let timestampScaleNs = 1000000; // default 1ms
  let clusterTimestamp = 0;

  function parse(data: Uint8Array, start: number, end: number) {
    let pos = start;
    while (pos < end) {
      const idResult = readElementId(data, pos);
      if (!idResult) break;
      pos += idResult.length;

      const sizeResult = readVint(data, pos);
      if (!sizeResult) break;
      pos += sizeResult.length;

      const elemId = idResult.id;
      const elemSize = sizeResult.value;
      const elemEnd = pos + elemSize;

      if (elemEnd > end) break;

      if (elemId === TIMESTAMP_SCALE_ID && elemSize <= 4) {
        let val = 0;
        for (let i = 0; i < elemSize; i++) val = val * 256 + data[pos + i];
        timestampScaleNs = val;
      } else if (elemId === CODEC_PRIVATE_ID) {
        codecPrivate = data.slice(pos, elemEnd);
      } else if (elemId === TIMECODE_ID) {
        let val = 0;
        for (let i = 0; i < elemSize; i++) val = val * 256 + data[pos + i];
        clusterTimestamp = val;
      } else if (elemId === SIMPLE_BLOCK_ID || elemId === BLOCK_ID) {
        // Parse block header: track number (vint) + int16 timecode + flags
        const trackVint = readVint(data, pos);
        if (trackVint) {
          const headerStart = pos + trackVint.length;
          if (headerStart + 3 <= elemEnd) {
            const blockTimecode = (data[headerStart] << 8) | data[headerStart + 1];
            // signed 16-bit
            const signedTimecode = blockTimecode > 32767 ? blockTimecode - 65536 : blockTimecode;
            const absoluteMs = (clusterTimestamp + signedTimecode) * (timestampScaleNs / 1000000);
            const packetStart = headerStart + 2 + 1; // +1 for flags byte
            if (packetStart < elemEnd) {
              packets.push({
                data: data.slice(packetStart, elemEnd),
                timestampMs: absoluteMs,
              });
            }
          }
        }
      } else if (MASTER_IDS.has(elemId)) {
        parse(data, pos, elemEnd);
        pos = elemEnd;
        continue;
      }

      pos = elemEnd;
    }
  }

  parse(webm, 0, webm.length);
  return { codecPrivate, packets };
}

// ─── Main converter ─────────────────────────────────────────────────────────
export function convertWebmToOgg(webmBytes: Uint8Array): Uint8Array {
  const { codecPrivate, packets } = extractOpusPackets(webmBytes);

  if (packets.length === 0) {
    throw new Error("No Opus packets found in WebM data");
  }

  const serialNumber = (Math.random() * 0x7FFFFFFF) >>> 0;
  let pageSequence = 0;

  // ── OpusHead header (RFC 7845 §5.1) ──
  let opusHead: Uint8Array;
  if (codecPrivate && codecPrivate.length >= 19 && 
      codecPrivate[0] === 0x4F && codecPrivate[1] === 0x70) {
    // CodecPrivate already contains a valid OpusHead
    opusHead = codecPrivate;
  } else {
    // Build minimal OpusHead: mono, 48kHz
    opusHead = new Uint8Array(19);
    const hv = new DataView(opusHead.buffer);
    // "OpusHead"
    opusHead.set([0x4F, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64]);
    opusHead[8] = 1;  // Version
    opusHead[9] = 1;  // Channel count (mono)
    hv.setUint16(10, 3840, true); // Pre-skip (common default)
    hv.setUint32(12, 48000, true); // Input sample rate
    hv.setInt16(16, 0, true); // Output gain
    opusHead[18] = 0; // Channel mapping family
  }

  // Extract pre-skip from OpusHead for granule calculation
  const preSkip = (opusHead[11] << 8) | opusHead[10]; // little-endian uint16 at offset 10

  // ── OpusTags header (RFC 7845 §5.2) ──
  const vendorStr = "Uz4FlowCRM";
  const opusTags = new Uint8Array(8 + 4 + vendorStr.length + 4);
  const tv = new DataView(opusTags.buffer);
  // "OpusTags"
  opusTags.set([0x4F, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73]);
  tv.setUint32(8, vendorStr.length, true);
  for (let i = 0; i < vendorStr.length; i++) opusTags[12 + i] = vendorStr.charCodeAt(i);
  tv.setUint32(12 + vendorStr.length, 0, true); // 0 comments

  // ── Build OGG pages ──
  const pages: Uint8Array[] = [];

  // Page 0: OpusHead (BOS = beginning of stream)
  pages.push(buildOggPage(serialNumber, pageSequence++, 0n, 0x02, [opusHead]));

  // Page 1: OpusTags
  pages.push(buildOggPage(serialNumber, pageSequence++, 0n, 0x00, [opusTags]));

  // Audio pages: pack multiple packets per page (max ~64KB or 255 segments)
  // Opus at 48kHz: each 20ms frame = 960 samples
  const SAMPLES_PER_FRAME = 960;
  let granulePosition = BigInt(preSkip);
  let currentPagePackets: Uint8Array[] = [];
  let currentPageSize = 0;
  const MAX_PAGE_SIZE = 60000; // Stay under 64KB limit

  for (let i = 0; i < packets.length; i++) {
    const pkt = packets[i].data;
    
    // Check if adding this packet exceeds page limits
    const segmentsNeeded = Math.floor(pkt.length / 255) + 1;
    const totalSegments = currentPagePackets.reduce((s, p) => s + Math.floor(p.length / 255) + 1, 0) + segmentsNeeded;
    
    if (currentPagePackets.length > 0 && (currentPageSize + pkt.length > MAX_PAGE_SIZE || totalSegments > 255)) {
      // Flush current page
      pages.push(buildOggPage(serialNumber, pageSequence++, granulePosition, 0x00, currentPagePackets));
      currentPagePackets = [];
      currentPageSize = 0;
    }

    granulePosition += BigInt(SAMPLES_PER_FRAME);
    currentPagePackets.push(pkt);
    currentPageSize += pkt.length;
  }

  // Flush remaining packets as final page (EOS = end of stream)
  if (currentPagePackets.length > 0) {
    pages.push(buildOggPage(serialNumber, pageSequence++, granulePosition, 0x04, currentPagePackets));
  }

  // Concatenate all pages
  const totalLen = pages.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const page of pages) {
    result.set(page, offset);
    offset += page.length;
  }

  return result;
}
