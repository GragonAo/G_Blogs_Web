import { DynamicObjectPoolService } from "@/G_FrameWork/Servers/ObjectPool/DynamicObjectPoolService";
import { GLObject } from "@/G_FrameWork/Servers/ObjectPool/GLObject";

export interface IUpdatable {
    Update(): void;
}

export class Container {
    private static instance: Container;
    private dependencies: Map<string, any> = new Map();
    private factories: Map<string, () => any> = new Map();
    private updatableObjects: Set<IUpdatable> = new Set();
    private dynamicObjectPoolService: DynamicObjectPoolService | undefined;
    private constructor() {
        this.register(DynamicObjectPoolService);
    }
    static getInstance(): Container {
        if (!Container.instance) {
            Container.instance = new Container();
        }
        return Container.instance;
    }

    register<T extends GLObject>(type: new () => T,...args: any[]): T|undefined {

        if (this.dependencies.has(type.name)) {
            console.log("已经注册到IOC容器中 :" + type.name);
            return undefined;
        }
        let obj = undefined;
        if (type.name === "DynamicObjectPoolService") {
            obj = new type();
            this.dynamicObjectPoolService = obj as any;
        } else {
            // 通过对象池解析依赖
            if (this.dynamicObjectPoolService) {
                const pool = this.dynamicObjectPoolService.GetPool<T>(type);
                obj = pool.MallocObject(1, 0, ...args);
            }
        }
        if (obj) {
            this.dependencies.set(type.name, obj);
            if (this.isUpdatable(obj)) {
                this.updatableObjects.add(obj);
            }
        }
        return obj;
    }

    registerFactory<T>(key: string, factory: () => T): void {
        this.factories.set(key, factory);
    }

    private isUpdatable(obj: any): obj is IUpdatable {
        return obj && typeof obj.Update === 'function';
    }

    get<T extends GLObject>(type: new () => T): T|undefined {
        const key = type.name;
        if (this.dependencies.has(key)) {
            const dependency = this.dependencies.get(key);
            return dependency;
        }
        console.warn(`未找到依赖 ${key}，尝试其他解析方式`);
        return undefined;
    }

    Update(): void {
        for (const obj of this.updatableObjects) {
            obj.Update();
        }
    }

    removeFromUpdateLoop(obj: IUpdatable): void {
        this.updatableObjects.delete(obj);
    }
}
