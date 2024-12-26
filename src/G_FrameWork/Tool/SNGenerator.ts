export class SNGenerator {
    private static lastTimestamp: number = 0;
    private static sequence: number = 0;
    private static readonly maxSequence: number = 9999;

    // CRC32表
    private static readonly crcTable: Uint32Array = (() => {
        const table = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) {
                c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            }
            table[i] = c;
        }
        return table;
    })();

    // 计算CRC32
    private static crc32(data: number[]): number {
        let crc = 0xffffffff;
        for (const byte of data) {
            crc = (crc >>> 8) ^ this.crcTable[(crc ^ byte) & 0xff];
        }
        return (crc ^ 0xffffffff) >>> 0;
    }

    public static generateSN(): number {
        const timestamp = Date.now();

        if (timestamp === SNGenerator.lastTimestamp) {
            SNGenerator.sequence = (SNGenerator.sequence + 1) % (SNGenerator.maxSequence + 1);
            if (SNGenerator.sequence === 0) {
                while (Date.now() === SNGenerator.lastTimestamp) {
                    // 使用setTimeout避免CPU空转
                    setTimeout(() => {}, 1);
                }
            }
        } else {
            SNGenerator.lastTimestamp = timestamp;
            SNGenerator.sequence = 0;
        }

        // 将时间戳和序列号转换为字节数组
        const data = [
            timestamp & 0xff,
            (timestamp >> 8) & 0xff,
            (timestamp >> 16) & 0xff,
            (timestamp >> 24) & 0xff,
            SNGenerator.sequence & 0xff,
            (SNGenerator.sequence >> 8) & 0xff
        ];

        // 生成CRC32作为SN
        return this.crc32(data);
    }

    // 用于测试的辅助方法
    public static reset(): void {
        SNGenerator.lastTimestamp = 0;
        SNGenerator.sequence = 0;
    }
}