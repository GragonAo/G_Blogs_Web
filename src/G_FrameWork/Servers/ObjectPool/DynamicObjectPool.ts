import { Queue } from "@/G_FrameWork/Tool/Queue";
import { CacheRefresh } from "@/G_FrameWork/Tool/CacheRefresh";
import { GLObject } from "@/G_FrameWork/Servers/ObjectPool/GLObject";
import { SNGenerator } from "@/G_FrameWork/Tool/SNGenerator";
import type { IDynamicObjectPool } from "@/G_FrameWork/Servers/ObjectPool/IDynamicObjectPool";

export class DynamicObjectPool<T extends GLObject> implements IDynamicObjectPool {
    private _free: Queue<T> = new Queue<T>();
    private _objInUse: CacheRefresh<T> = new CacheRefresh<T>();
    private _objectType: new () => T; // 添加存储类型构造函数的属性

    constructor(type?: new () => T) {
        this._objectType = type || GLObject as any;
    }
    // 更新对象池中的状态
    public Update(): void {
        if (this._objInUse.CanSwap()) {
            this._objInUse.Swap(this._free);
        }
    }

    // 释放对象
    public FreeObject(obj: T): void {
        if (obj.GetSN() === 0) {
            console.error("FreeObject SN is 0");
            return;
        }
        obj.BackToPool();
        this._objInUse.RemoveObj(obj.GetSN());
    }

    // 分配对象
    public MallocObject(count: number=1, sn: number = 0, ...args: any[]): T | undefined {
        let pObj: T;

        // 如果队列为空，创建新的对象
        if (this._free.size() === 0) {
            for (let i = 0; i < count; i++) {
                pObj = new this._objectType();
                this._free.enqueue(pObj);
            }
        }

        // 从队列中取出一个对象
        pObj = this._free.dequeue() as T;
        if (pObj.GetSN() !== 0) {
            console.error("MallocObject SN is not 0");
            return;
        }

        if (sn === 0) {
            // 生成新的 SN
            sn = SNGenerator.generateSN();
        }
        pObj.SetPool(this);
        pObj.SetSN(sn);
        pObj.Awake(...args);

        this._objInUse.AddObj(pObj);
        return pObj;
    }

// 打印对象池的状态
public Show(): void {
    const borderLength = 50; // Total length of the border line
    const title = this._objectType.name;
    const paddingLength = Math.max(0, Math.floor((borderLength - title.length) / 2));

    // 打印对象池的类型名称，居中
    console.log(
        `%c${'='.repeat(paddingLength)}${title}${'='.repeat(borderLength - title.length - paddingLength)}`
        , 'color: red; font-weight: bold;'
    );

    // 打印空闲对象数量
    console.log(`%cFree Objects: ${this._free.size()} (Total ${this._free.size() + this._objInUse.count} items)`, 'color: green; font-weight: bold;');
    
    if (this._objInUse.count === 0) {
        console.log("%c  No objects in use.", 'color: gray;');
    } else {
        this._objInUse.Show();
    }

    console.log("%c====================================================", 'color: red; font-weight: bold;');
}


}
