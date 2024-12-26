import { Container } from "@/G_FrameWork/Container";
import { CommandServer } from "@/G_FrameWork/Servers/CommandServer";
import { EventServer } from "@/G_FrameWork/Servers/Event/EventServer";
import { FileServer } from "@/G_FrameWork/Servers/Files/FileServer";
import { PackageServer } from "@/G_FrameWork/Servers/Models/PackageServer";
import { HttpServer } from "@/G_FrameWork/Servers/Net/HttpServer";
import { DynamicObjectPoolService } from "@/G_FrameWork/Servers/ObjectPool/DynamicObjectPoolService";
import { TaskServer } from "@/G_FrameWork/Servers/TaskServer/TaskServer";
import { IndexDB } from "@/G_FrameWork/Tool/IndexDB";

export class AppStart {
    private container: Container;
    private lastTime: number = 0;
    private readonly fps: number = 20; // 设置目标fps
    private readonly frameInterval: number = 1000 / this.fps; // 计算帧间隔时间

    constructor() {
        console.log("App created!");
        this.container = Container.getInstance();
        this.initialize();
    }

    private initialize(): void {
        console.log("App initialized!");
        this.container.register(EventServer);
        this.container.register(CommandServer);
        this.container.register(HttpServer);
        // this.container.register(IndexDB);
        // this.container.register(FileServer);
        // this.container.register(PackageServer);
        // this.container.register(TaskServer,3);
        this.container.get(DynamicObjectPoolService)?.Awake();
        this.Update();
    }

    public Update(currentTime: number = 0): void {
        requestAnimationFrame(this.Update.bind(this));
        const deltaTime = currentTime - this.lastTime;
        if (deltaTime < this.frameInterval) return; // 如果间隔太短就跳过这一帧
        this.lastTime = currentTime - (deltaTime % this.frameInterval);
        this.container.Update();
    }
}
