export class ITask {
    id: number;
    type: string; // 任务类型
    imgUrl: string; // 任务图片
    priority: number; // 优先级
    filename: string; // 文件名
    filePath: string; // 文件路径
    status: 'Pending' | 'Running' | 'Completed' | 'Failed';
    progress: number; // 任务进度
    data: any;
    onProgress?: () => void;
    onStatusChange?: (task: ITask) => Promise<void>; // 状态变更通知回调
    nextTask: ITask | undefined; // 下一个任务
    Execute(): Promise<void>; // 执行任务
    Cancel(): void; // 取消任务
}
