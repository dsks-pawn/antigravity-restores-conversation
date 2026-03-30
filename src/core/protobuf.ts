// Protobuf varint decoding and basic manipulations ported from Python

export function encodeVarint(val: number): Buffer {
    let value = val;
    const bytes: number[] = [];
    while (value > 0x7F) {
        bytes.push((value & 0x7F) | 0x80);
        value >>>= 7;
    }
    bytes.push(value & 0x7F);
    return Buffer.from(bytes.length ? bytes : [0]);
}

export function decodeVarint(data: Buffer, startPos: number): [number, number] {
    let result = 0;
    let shift = 0;
    let pos = startPos;
    while (pos < data.length) {
        const b = data[pos];
        result |= (b & 0x7F) << shift;
        if ((b & 0x80) === 0) {
            return [result, pos + 1];
        }
        shift += 7;
        pos++;
    }
    return [result, pos];
}

export function skipProtobufField(data: Buffer, startPos: number, wireType: number): number {
    let pos = startPos;
    if (wireType === 0) {
        // varint
        const dec = decodeVarint(data, pos);
        pos = dec[1];
    } else if (wireType === 2) {
        // length-delimited
        const [length, newPos] = decodeVarint(data, pos);
        pos = newPos + length;
    } else if (wireType === 1) {
        pos += 8;
    } else if (wireType === 5) {
        pos += 4;
    }
    return pos;
}

export function stripFieldFromProtobuf(data: Buffer, targetFieldNumber: number): Buffer {
    const chunks: Buffer[] = [];
    let pos = 0;
    while (pos < data.length) {
        const startPos = pos;
        let tag = 0;
        try {
            [tag, pos] = decodeVarint(data, pos);
        } catch (e) {
            chunks.push(data.subarray(startPos));
            break;
        }
        const wireType = tag & 7;
        const fieldNum = tag >>> 3;
        const newPos = skipProtobufField(data, pos, wireType);

        if (newPos === pos && ![0, 1, 2, 5].includes(wireType)) {
            chunks.push(data.subarray(startPos));
            break;
        }

        if (fieldNum !== targetFieldNumber) {
            chunks.push(data.subarray(startPos, newPos));
        }
        pos = newPos;
    }
    return Buffer.concat(chunks);
}

export function encodeLengthDelimited(fieldNumber: number, data: Buffer): Buffer {
    const tag = (fieldNumber << 3) | 2;
    return Buffer.concat([
        encodeVarint(tag),
        encodeVarint(data.length),
        data
    ]);
}

export function encodeStringField(fieldNumber: number, stringValue: string): Buffer {
    return encodeLengthDelimited(fieldNumber, Buffer.from(stringValue, 'utf-8'));
}
