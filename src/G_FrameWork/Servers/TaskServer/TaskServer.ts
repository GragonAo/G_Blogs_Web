import { Container } from "@/G_FrameWork/Container";
import { Server } from "@/G_FrameWork/Servers/Server";
import type { ITask } from "@/G_FrameWork/Servers/TaskServer/ITask";
import { CommandServer } from "@/G_FrameWork/Servers/CommandServer";
import { ref } from "vue";

export class TaskServer extends Server {
    private maxThreads: number = 3;
    private queue = ref<ITask[]>([]);
    private activeTasks = ref<Map<number, ITask>>();

    public Awake(...args: any[]): void {
        this.activeTasks.value = new Map();
        this.maxThreads = args[0];
        Container.getInstance().get(CommandServer)!.registerCommand('task -all', this.Show.bind(this));
    }

    // 添加任务（按优先级插入队列）
    public AddTask(task: ITask): number {
        this.queue.value.push(task);
        this.queue.value.sort((a, b) => b.priority - a.priority); // 按优先级排序
        this.StartNextTask();
        return task.id;
    }

    // 开始下一个任务
    private StartNextTask(): void {
        while (this.activeTasks.value!.size < this.maxThreads && this.queue.value.length > 0) {
            const task = this.queue.value.shift()!;
            task.status = 'Running';
            this.activeTasks.value!.set(task.id, task);
            console.log(`开始执行任务 ${task.id}`);
            
            // 使用Promise.resolve确保异步执行
            Promise.resolve().then(async () => {
                try {
                    await task.Execute();
                    console.log(`任务 ${task.id} 执行完成${task.nextTask ? ', 准备执行下一个任务' : ''}`);
                    task.progress = 100;
                    task.status = 'Completed';
                    
                    if (task.onStatusChange) {
                        await task.onStatusChange(task);
                    }
                } catch (error) {
                    console.error(`任务 ${task.id} 执行失败:`, error);
                    task.status = 'Failed';
                    if (task.onStatusChange) {
                        await task.onStatusChange(task);
                    }
                } finally {
                    this.activeTasks.value!.delete(task.id);
                    const nextTask = task.nextTask;
                    task.Cancel();
                    await Promise.resolve();
                    if (nextTask) {
                        console.log(`准备执行链中的下一个任务: ${nextTask.id}`);
                        this.AddTask(nextTask);
                    }else{
                        this.StartNextTask();
                    }
                }
            });
        }
    }

    // 手动取消任务
    public CancelTask(taskId: number): void {
        const task = this.activeTasks.value!.get(taskId) || this.queue.value.find(t => t.id === taskId);
        if (task) {
            task.Cancel();
            task.status = 'Failed';
            task.onStatusChange?.(task); // 通知状态变更
            this.activeTasks.value!.delete(taskId);
            this.queue.value = this.queue.value.filter(t => t.id !== taskId); // 从队列中移除
        }
    }

    // 获取任务状态
    public GetTaskStatus(taskId: number): ITask | undefined {
        return this.activeTasks.value!.get(taskId) || this.queue.value.find(t => t.id === taskId);
    }

    // 获取任务进度
    public GetTaskProgress(taskId: number): number | undefined {
        const task = this.activeTasks.value!.get(taskId) || this.queue.value.find(t => t.id === taskId);
        return task?.progress;
    }
    public GetActiveTasks(): Map<number, ITask> {
        return this.activeTasks.value!;
    }
    public GetQueueTasks(): ITask[] {
        return this.queue.value;
    }
    public GetTask(taskId:number):ITask|undefined{
        return this.activeTasks.value?.get(taskId);
    }
    //判断id是否在任务中
    public IsIdInTasking(taskId:number):boolean{
        return this.GetTaskProgress(taskId) !== undefined;
    }
    public Show(): void {
        console.log("┌─────────────────────────────────────┐");
        console.log("│           当前任务情况             │");
        console.log("├─────────────────────────────────────┤");
        console.log("│             活跃任务               │");
        this.activeTasks.value!.forEach((task, id) => {
            console.log("│ " + `任务ID: ${id}, 状态: ${task.status}, 进度: ${task.progress}`.padEnd(37) + "│");
        });

        console.log("├─────────────────────────────────────┤");
        console.log("│             队列任务               │");
        this.queue.value.forEach((task:ITask) => {
            console.log("│ " + `任务ID: ${task.id}, 状态: ${task.status}, 进度: ${task.progress}`.padEnd(37) + "│");
        });
        console.log("└─────────────────────────────────────┘");
    }
}
