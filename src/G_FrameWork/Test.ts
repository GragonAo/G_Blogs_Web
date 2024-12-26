import { GLObject } from "@/G_FrameWork/Servers/ObjectPool/GLObject";

export class Test extends GLObject {
    public override Awake(...args: any[]): void {
        console.log('Test object awakened with', args[0].toString());
    }

    public BackToPool(): void {
        console.log('Test object returned to pool');
    }

    public Dispose(): void {
        console.log('Test object disposed');
    }
}