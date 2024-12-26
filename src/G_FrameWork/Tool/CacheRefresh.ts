import type { GLObject } from "@/G_FrameWork/Servers/ObjectPool/GLObject";
import type { Queue } from "@/G_FrameWork/Tool/Queue";
import { AsyncLock } from "@/G_FrameWork/Tool/AsyncLock";

export class CacheRefresh<T extends GLObject> {
    private _objs: Map<number, T> = new Map();
    private _adds: Map<number, T> = new Map();
    private _removes: Set<number> = new Set();
    private _lock: AsyncLock = new AsyncLock();

    public GetReaderCache(): Map<number, T> {
        return new Map(this._objs); // 返回副本避免外部修改
    }

    public async AddObj(pObj: T): Promise<void> {
        await this._lock.lock();
        try {
            const sn = pObj.GetSN();
            this._adds.set(sn, pObj);
        } finally {
            this._lock.unlock();
        }
    }

    public async RemoveObj(sn: number): Promise<void> {
        await this._lock.lock();
        try {
            this._removes.add(sn);
        } finally {
            this._lock.unlock();
        }
    }

    public get count(): number {
        return this._objs.size + this._adds.size;
    }

    public async Swap(pRecycleList: Queue<T> | null): Promise<void> {
        await this._lock.lock();
        try {
            // 处理添加的对象
            for (const [sn, obj] of this._adds) {
                this._objs.set(sn, obj);
            }
            this._adds.clear();

            // 处理删除的对象
            for (const sn of this._removes) {
                const obj = this._objs.get(sn);
                if (obj) {
                    if (pRecycleList) {
                        obj.ResetSN(true);
                        pRecycleList.enqueue(obj);
                    }
                    this._objs.delete(sn);
                } else {
                    console.warn(`CacheRefresh Swap: Object not found for SN ${sn}`);
                }
            }
            this._removes.clear();
        } finally {
            this._lock.unlock();
        }
    }

    public CanSwap(): boolean {
        return this._adds.size > 0 || this._removes.size > 0;
    }

    public async BackToPool(): Promise<void> {
        await this._lock.lock();
        try {
            [...this._adds.values(), ...this._objs.values()].forEach(obj => obj.BackToPool());
            this._adds.clear();
            this._objs.clear();
            this._removes.clear();
        } finally {
            this._lock.unlock();
        }
    }

    public async Dispose(): Promise<void> {
        await this._lock.lock();
        try {
            [...this._adds.values(), ...this._objs.values()].forEach(obj => obj.Dispose());
            this._adds.clear();
            this._objs.clear();
            this._removes.clear();
        } finally {
            this._lock.unlock();
        }
    }

    public async Show(): Promise<void> {
        console.log("%c┌──────────────── Objects in Use: ─────────────────┐", 'color: green; font-weight: bold;');
        console.log(`%c│ In Use: ${this._objs.size}    To Add: ${this._adds.size}    To Remove: ${this._removes.size}`, 'color: blue;');
        // this._objs.forEach(obj => console.log(obj));
        console.log(`%c│ Total Objects Count: ${this.count} `, 'color: red;');
        console.log("%c└──────────────────────────────────────────────────┘", 'color: green; font-weight: bold;');
    }
}