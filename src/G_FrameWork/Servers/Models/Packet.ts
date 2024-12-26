import pako from 'pako'
import { GLObject } from '@/G_FrameWork/Servers/ObjectPool/GLObject';
import type { DBPFEntry } from 'dbpf';
export class Package extends GLObject{
    private _name:string|undefined;
    private _entryCount: number = 0
    private _imageCount: number = 0
    private _images: string[]|undefined;
    public entryCount(): number { return this._entryCount }
    public imageCount(): number { return this._imageCount }
    public images(): string[] { return this._images! }
    public Name():string{return this._name!;}
    public fileName: string|undefined;
    public override Awake(...args: any[]): void {
        this._name = args[0];
        this._images = [];
    }
    public override BackToPool(): void {
        this._entryCount = 0;
        this._imageCount = 0;
        this._images = [];
        this._name = undefined;
    }
    public async ProcessEntry(entry: any) {
        if (entry && entry.type === 0x3C1AF1F2) {
            await this.ProcessImageEntry(entry)
        }
    }
    private async ProcessImageEntry(entry: DBPFEntry) {
        try {
            const compressedBlob = await entry.blob()
            const arrayBuffer = await compressedBlob.arrayBuffer()
            const decompressedBuffer = pako.inflate(new Uint8Array(arrayBuffer))
            const decompressedBlob = new Blob([decompressedBuffer], { type: 'image/png' })
            const imageUrl = URL.createObjectURL(decompressedBlob)
            this._images!.push(imageUrl);
            this._imageCount++
        } catch (err) {
            console.error('Image decompression failed:', err)
        }
    }
    public SetEntryCount(count: number) {
        this._entryCount = count
    }
}