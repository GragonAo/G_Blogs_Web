import { GLObject } from "@/G_FrameWork/Servers/ObjectPool/GLObject";

export interface IDynamicObjectPool {
    Update();
    FreeObject(obj: GLObject);
    Show();
}