import { Container } from "@/G_FrameWork/Container";
import { FileServer } from "@/G_FrameWork/Servers/Files/FileServer";
import { DynamicObjectPoolService } from "@/G_FrameWork/Servers/ObjectPool/DynamicObjectPoolService";
import { TaskServer } from "@/G_FrameWork/Servers/TaskServer/TaskServer";
import { ExampleTask } from "@/G_FrameWork/Servers/TaskServer/ExampleTask";
import { DownloadTask } from "@/G_FrameWork/Servers/TaskServer/DownloadTask";

export class Demo {
    private dynamicObjectPoolService: DynamicObjectPoolService;
    private ioc = Container.getInstance();
    private taskServer: TaskServer|undefined;
    private fileServer: FileServer|undefined;
    constructor() {
        this.dynamicObjectPoolService = this.ioc.get(DynamicObjectPoolService)!;
        this.fileServer = this.ioc.get(FileServer);
    }
    public OnClick(){
        this.taskServer = this.ioc.get(TaskServer);
        console.log(this.taskServer)
        this.testTaskServer();
    }
    private async testTaskServer(): Promise<void> {
        const content = await this.fileServer?.GetFileContent("/Test/localMods/真实生活-美妆系统.zip");
        console.log(content)
        const blob = new Blob([content!], { type: 'application/zip' });
        if(!content) return;
        // 创建并添加 ExampleTask
        const exampleTask1 = this.dynamicObjectPoolService.GetPool(ExampleTask).MallocObject(20,0,blob,"/Mods/真实生活-美妆系统", 1);

        // 创建并添加 DownloadTask
        //TODO 解决下载跨域问题
        const downloadTask = this.dynamicObjectPoolService.GetPool(DownloadTask).MallocObject(20,0, "https://minio.aimuc.cn/mods/storage/af28ca3a9d5707ff3cd8315b37e8dbe3.zip?X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=G0hw9zBw4WATti0zlt7C%2F20241205%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20241205T155724Z&X-Amz-SignedHeaders=host&X-Amz-Expires=300&X-Amz-Signature=b9e5582931e6a49eb267f8b0143b60439dd59035e6aa7e24c8a06d23d5e4bb44", "file.zip", "/path/to/save", 3);
    }
}
