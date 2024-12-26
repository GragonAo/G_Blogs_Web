import { GLObject } from "@/G_FrameWork/Servers/ObjectPool/GLObject";
import { ArrayList } from "@/G_FrameWork/Tool/List";

export class CacheSwap<T extends GLObject> {
    private _caches1: ArrayList<T> = new ArrayList();
    private _caches2: ArrayList<T> = new ArrayList();

    private _readerCache: ArrayList<T>;
    private _writerCache: ArrayList<T>;

    constructor() {
        this._writerCache = this._caches1;
        this._readerCache = this._caches2;
    }

    // 获取写缓存
    public GetWriterCache(): ArrayList<T> {
        return this._writerCache;
    }

    // 获取读缓存
    public GetReaderCache(): ArrayList<T> {
        return this._readerCache;
    }

    // 交换读写缓存
    public Swap(): void {
        const temp = this._readerCache;
        this._readerCache = this._writerCache;
        this._writerCache = temp;
    }

    // 是否可以交换缓存
    public CanSwap(): boolean {
        return this._writerCache.length > 0;
    }

    // 返回缓存中的对象到对象池
    public BackToPool(): void {
        for (const item of this._caches1) {
            item.BackToPool();
        }
        this._caches1.clear();

        for (const item of this._caches2) {
            item.BackToPool();
        }
        this._caches2.clear();
    }
}
