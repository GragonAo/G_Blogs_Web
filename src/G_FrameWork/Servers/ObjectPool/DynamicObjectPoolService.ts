import { Container,type IUpdatable } from "@/G_FrameWork/Container";
import { GLObject } from "@/G_FrameWork/Servers/ObjectPool/GLObject";
import { DynamicObjectPool } from "@/G_FrameWork/Servers/ObjectPool/DynamicObjectPool"; // 假设这里是正确导入的
import { SNGenerator } from "@/G_FrameWork/Tool/SNGenerator";
import {CommandServer } from "@/G_FrameWork/Servers/CommandServer";
import type { IDynamicObjectPool } from "@/G_FrameWork/Servers/ObjectPool/IDynamicObjectPool";
export class DynamicObjectPoolService extends GLObject implements IUpdatable {

    private pools: Map<string, IDynamicObjectPool> = new Map();
    constructor(){
        super();
    }
    public BackToPool() {
        
    }
    public Awake(...args: any[]) {
        Container.getInstance().get(CommandServer)?.registerCommand('pool -all', this.Show.bind(this));
    }
    public Dispose() {

    }
    GetPool<T extends GLObject>(type: new () => T): DynamicObjectPool<T> {
        const key = type.name;
        if (!this.pools.has(key)) {
            this.pools.set(key, new DynamicObjectPool<T>(type));
        }
        return this.pools.get(key) as DynamicObjectPool<T>;
    }

    Update(): void {
        for (const pool of this.pools.values()) {
            pool.Update();
        }
    }
    public Show() {
        console.log('DynamicObjectPoolService Show');
        for (const pool of this.pools.values()) {
            pool.Show();
        }
    }
}
