import type { AxiosProgressEvent, CancelTokenSource } from "axios";
import axios from "axios";
import CryptoJS from 'crypto-js';
import type { ITask } from "@/G_FrameWork/Servers/TaskServer/ITask";
import { GLObject } from "@/G_FrameWork/Servers/ObjectPool/GLObject";
import { Container } from "@/G_FrameWork/Container";
import { FileServer } from "../Files/FileServer";
import { APP_CONFIG } from "~/app.config";

export class DownloadTask extends GLObject implements ITask {
    public id: number = 0;
    public type = 'download';
    public imgUrl: string = ""; // 任务图片
    public filename: string = ""; // 文件名
    public filePath: string = ""; // 文件路径
    public priority: number = 0; // 优先级
    public status: 'Pending' | 'Running' | 'Completed' | 'Failed' = 'Pending';
    public progress: number = 0;
    public data: any = undefined;
    public onProgress?: () => void;
    public onStatusChange?: (task: ITask) => Promise<void>;
    public nextTask: ITask | undefined;

    private url: string = "";
    private md5: string = "";
    private cancelTokenSource: CancelTokenSource | undefined;
    private fileServer: FileServer | undefined;

    public override Awake(...args: any[]): void {
        this.id = args[0];
        this.imgUrl = args[1];
        this.filePath = args[2];
        this.filename = args[3];
        this.priority = args[4];
        this.url = args[5];
        this.md5 = args[6];
        this.cancelTokenSource = axios.CancelToken.source();
        this.fileServer = Container.getInstance().get(FileServer);
    }
    override BackToPool(): void {
        this.id = 0;
        this.type = 'download';
        this.imgUrl = ""; // 任务图片
        this.priority = 0; // 优先级
        this.filename = ""; // 文件名
        this.filePath = ""; // 文件路径
        this.status = 'Pending';
        this.progress = 0;
        this.data = undefined;
        this.onProgress = undefined;
        this.onStatusChange = undefined;
        this.url = "";
        this.cancelTokenSource = undefined;
        this.fileServer = undefined;
        super.BackToPool();
    }

    // 计算文件MD5的辅助方法
    private async calculateMD5(blob: Blob): Promise<string> {
        const arrayBuffer = await blob.arrayBuffer();
        const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
        return CryptoJS.MD5(wordArray).toString();
    }

    async Execute(): Promise<void> {
        this.status = 'Running';
        try {
            const file = await this.fileServer?.GetFileByPath(APP_CONFIG.imagesBasePath + this.filename!);
            if (file !== undefined) {
                console.log(`文件 ${this.filename} 已存在`);
                const data = await file.GetContent();
                if (this.nextTask && data) {
                    const arrayBuffer = await data.arrayBuffer();
                    this.nextTask.data = new Blob([arrayBuffer]);
                }
                this.progress = 100;
                return;
            }

            // 创建专门的下载axios实例
            const downloadAxios = axios.create({
                timeout: 300000,
                withCredentials: false,
                headers: {
                    'Accept': '*/*',
                },
                maxRedirects: 5,
                validateStatus: (status) => status >= 200 && status < 300,
            });
            await downloadAxios.get(this.url, {
                responseType: 'blob',
                cancelToken: this.cancelTokenSource?.token,
                onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
                    if (progressEvent.total) {
                        this.progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                        this.onProgress?.();
                    }
                },
            }).then(async (res) => {
                if (this.filename.endsWith('.zip')) {
                    // 计算下载文件的MD5
                    const downloadedMD5 = await this.calculateMD5(res.data);

                    // // 验证MD5
                    if (downloadedMD5 !== this.md5) {
                        throw new Error(`MD5校验失败：期望值 ${this.md5}，实际值 ${downloadedMD5}`);
                    }
                }
                if (this.filename === undefined) return;
                await this.fileServer!.CreateFile(this.filePath, this.filename, res.data);

                if (this.nextTask) {
                    this.nextTask.data = res.data;
                }

                console.log(`文件 ${this.filename} 下载完成并通过MD5校验`);
                this.progress = 100;
            });
        } catch (error: any) {
            this.status = 'Failed';
            throw error;
        }
    }

    Cancel(): void {
        if (this.cancelTokenSource) {
            this.cancelTokenSource.cancel(`Task ${this.id} canceled.`);
            this.status = 'Failed';
        }
        this._pool?.FreeObject(this);
    }
}
