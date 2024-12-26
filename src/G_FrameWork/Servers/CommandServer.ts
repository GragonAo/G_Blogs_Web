import { GLObject } from "@/G_FrameWork/Servers/ObjectPool/GLObject";

declare global {
    interface Window {
        cmd: (command: string) => void;
        listCmd: () => void;
    }
}

export class CommandServer extends GLObject{
    private commands: { [key: string]: () => void } = {};

    constructor() {
        super();
        // 将 cmd 和 listCmd 方法挂载到 window 上
        window.cmd = (command: string) => {
            this.cmd(command);
        };

        window.listCmd = () => {
            this.listCommands();
        };
    }

    // 注册新的命令
    public registerCommand(command: string, handler: () => void): void {
        this.commands[command] = handler;
    }

    // 命令解析器
    public cmd(command: string): void {
        if (this.commands[command]) {
            this.commands[command]();
        } else {
            console.log(`未知命令: ${command}`);
        }
    }

    // 打印所有注册过的命令
    public listCommands(): void {
        console.log("已注册的命令:");
        for (const command in this.commands) {
            console.log(command);
        }
    }
}
