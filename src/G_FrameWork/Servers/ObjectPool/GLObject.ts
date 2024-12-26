import type { IDynamicObjectPool } from "@/G_FrameWork/Servers/ObjectPool/IDynamicObjectPool";

export class GLObject {
    protected _sn: number = 0;
    protected _pool: IDynamicObjectPool|undefined;

    public SetSN(sn: number) {
        this._sn = sn;
    }
    public GetSN() {
        return this._sn;
    }
    public ResetSN(isRecycle: boolean) {
        if(isRecycle){
            this._sn = 0;
        }
    }
    public SetPool(pool: IDynamicObjectPool) {
        this._pool = pool;
    }
    public BackToPool() { }
    public Awake(...args: any[]) { }
    public Dispose() { }
}