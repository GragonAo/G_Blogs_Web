import { Container } from '@/G_FrameWork/Container';
import { FileServer } from '@/G_FrameWork/Servers/Files/FileServer';
import { GLObject } from '@/G_FrameWork/Servers/ObjectPool/GLObject';
import type { ITask } from '@/G_FrameWork/Servers/TaskServer/ITask';
import type { ConfigJson } from '../Files/ConfigJson';

export class ExampleTask extends GLObject implements ITask {
    data: any = undefined;
    nextTask: ITask | undefined;
    id: number = 0;
    type: string ="example";
    imgUrl: string = "";
    filePath: string="";
    filename: string="";
    priority: number= 0;
    status: 'Pending' | 'Running' | 'Completed' | 'Failed' = 'Pending';
    progress: number = 0;
    onProgress?: () => void;
    onStatusChange?: (task: ITask) => Promise<void>;

    private _configJson:ConfigJson|undefined;
    private _fileServer: FileServer|undefined;
    public override Awake(...args: any[]): void {
        this.id = args[0];
        this.imgUrl = args[1];
        this.filePath = args[2];
        this.filename = args[3];
        this.priority = args[4];
        this._configJson = args[5];
        this._fileServer = Container.getInstance().get(FileServer);
    }

    async Execute(): Promise<void> {
        try {
            if(this.data === undefined)return;
            console.log(`解压任务 ${this.id} 开始执行`);
            this.status = 'Running';
            this.progress = 0;
            console.log(`解压任务 ${this.id} 开始解压: 路径=${this.filePath}, 数据大小=${this.data.size}`);
            await this._fileServer?.ExtractZipFile(this.data, this.filePath, this.id);
            if(this._configJson !== undefined){
                const jsonStr = JSON.stringify(this._configJson);
                console.log(jsonStr);
                await this._fileServer!.CreateFile(this.filePath,"config.json",jsonStr);
                this._fileServer!.AddInstallModId(this._configJson!);
            }
            this.progress = 99;
            console.log(`解压任务 ${this.id} 执行完成`);
        } catch (error) {
            console.error(`解压任务 ${this.id} 执行失败:`, error);
            this.status = 'Failed';
            throw error;
        }
    }

    Cancel(): void {
        this._pool?.FreeObject(this);
    }
}
