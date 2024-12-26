import { Container } from "@/G_FrameWork/Container";
import { GLObject } from "@/G_FrameWork/Servers/ObjectPool/GLObject";
import { FileServer } from "@/G_FrameWork/Servers/Files/FileServer";
import { DynamicObjectPoolService } from "@/G_FrameWork/Servers/ObjectPool/DynamicObjectPoolService";
import type { DynamicObjectPool } from "@/G_FrameWork/Servers/ObjectPool/DynamicObjectPool";
import type { ContentType } from "./ConfigJson";

// 文件节点类
export class FileNode extends GLObject {
    private _handle: FileSystemFileHandle | undefined;
    public curPath: string | undefined;

    public override Awake(...args: any[]): void {
        this.UpdateNode(args[0], args[1]);
    }
    public override BackToPool(): void {
        this._handle = undefined;
        this.curPath = undefined;
    }
    public UpdateNode(handle: FileSystemFileHandle, path: string) {
        this._handle = handle;
        this.curPath = `${path}/${handle.name}`.replace(/\/+/g, '/');    // 拼接路径并去除重复的斜杠
    }

    // 获取文件内容，支持文本和二进制格式
    public async GetContent(): Promise<File | undefined> {
        try {
            const file = await this._handle?.getFile();
            if (!file) return undefined;
            return file;
        } catch (error) {
            throw new Error(`文件读取失败: ${this.curPath}`);
        }
    }

    // 更新文件内容
    public async UpdateContent(content: ContentType): Promise<void> {
        try {
            const writable = await this._handle?.createWritable();
            if (writable === undefined) return;
            if (typeof content === "string") {
                await writable.write(content);
            } else if (content instanceof File) {
                await writable.write(content);
            }
            else if (content instanceof Blob) {
                await writable.write(content);
            } else if (content instanceof ArrayBuffer) {
                await writable.write(new Blob([content]));
            }
            await writable.close();
        } catch (error) {
            console.error(`更新文件内容失败: ${this.curPath}`, error);
        }
    }

    // 删除文件并释放资源
    public async DeleteFile(): Promise<void> {
        try {
            if (this.curPath === undefined) return;
            Container.getInstance().get(FileServer)?.Delete(this.curPath!);
        } catch (error) {
            console.error(`删除文件失败: ${this.curPath}`, error);
        }
    }
    public Delete() {
        (this._pool as DynamicObjectPool<FileNode>).FreeObject(this);
    }

    public async Move(toNode: FolderNode, newName?: string): Promise<void> {
        try {
            if (newName === undefined) {
                (this._handle as any).move(toNode.GetHandle());
            } else {
                (this._handle as any).move(toNode.GetHandle(), newName);
            }
            toNode.files.push(this);
        } catch (error) {
            console.error(`移动文件失败: ${this.curPath} 到 ${toNode.curPath}`, error);
        }
    }

    public async Rename(newName: string): Promise<FileNode|undefined> {
        try {
            (this._handle as any).move(newName);
            return this;
        } catch (error) {
            throw new Error(`重命名文件失败: ${this.curPath}`);
            return undefined;
        }
    }

    // 获取文件名
    get Name(): string | undefined {
        return this._handle?.name;
    }

    // 获取文件类型
    get Type(): string {
        return this.Name?.split(".").pop() || "";
    }
    public GetHandle(): FileSystemFileHandle | undefined {
        return this._handle;
    }
    public SetHandle(handle: FileSystemFileHandle) {
        this._handle = handle;
    }
}

// 文件夹节点类
export class FolderNode extends GLObject {
    private _handle: FileSystemDirectoryHandle | undefined;
    public files: FileNode[] = [];
    public subFolders: FolderNode[] = [];
    public specialFolders: FolderNode[] = [];
    public normalFolders: FolderNode[] = [];
    public curPath: string | undefined;

    public override Awake(...args: any[]): void {
        this.updateNode(args[0], args[1]);
    }
    public override BackToPool(): void {
        this.files = [];
        this.specialFolders = [];
        this.normalFolders = [];
        this.subFolders = [];
        this._handle = undefined;
        this.curPath = undefined;
        console.log(`BackToPool object with SN: ${this.GetSN()}`);
    }
    public updateNode(handle: FileSystemDirectoryHandle, path: string) {
        this._handle = handle;
        this.curPath = `${path}/${this._handle.name}`.replace(/\/+/g, '/');    // 拼接路径并去除重复的斜杠
    }

    // 创建文件
    public async CreateFile(fileNameStr: string, content: ContentType): Promise<FileNode | undefined> {
        try {
            const fileName= fileNameStr.replace(/[\x00-\x1F\x7F]/g, '');
            const fileHandle = await this._handle?.getFileHandle(fileName, { create: true });
            if (!fileHandle) return undefined;
            let fileNode = this.GetFile(fileName);
            if (fileNode) {
                fileNode.SetHandle(fileHandle);
            } else {
                const pool = Container.getInstance().get(DynamicObjectPoolService)!.GetPool(FileNode);
                fileNode = pool.MallocObject(50, 0, fileHandle, this.curPath);
                if (fileNode === undefined) return undefined;
                this.files.push(fileNode);
            }
            await fileNode!.UpdateContent(content);
            this.UpdateFolder();
            return fileNode;
        } catch (error) {
            throw new Error(`创建文件失败: ${this.curPath}/${fileNameStr}`);
        }
    }

    // 创建文件夹
    public async CreateFolder(folderName: string): Promise<FolderNode | undefined> {
        try {
            if (this._handle === undefined) return undefined;
            const folderHandle = await this._handle.getDirectoryHandle(folderName, { create: true });
            let folderNode = this.GetFolder(folderName);
            if (folderNode) {
                folderNode._handle = folderHandle;
            } else {
                const pool = this._pool as DynamicObjectPool<FolderNode>;
                folderNode = pool.MallocObject(50, 0, folderHandle, this.curPath);
                if (folderNode === undefined) return undefined;
                this.subFolders.push(folderNode);
            }
            this.UpdateFolder();
            return folderNode;
        } catch (error) {
            throw new Error(`创建文件夹失败: ${this.curPath}/${folderName}`);
        }
    }

    // 获取文件
    public GetFile(fileName: string): FileNode | undefined {
        try {
            return this.files.find(file => file.Name === fileName);
        } catch (err) {
            throw new Error(`Error retrieving file: ${fileName}. `);
        }
    }
    // 获取子文件夹
    public GetFolder(folderName: string): FolderNode | undefined {
        try {
            return this.subFolders.find(folder => folder.Name === folderName);
        } catch (err) {
            throw new Error(`Error retrieving folder: ${folderName}. `);
        }
    }
    public UpdateFolder() {
        let tempS = [];
        let tempN = [];
        for (let i = 0; i < this.subFolders.length; i++) {
            if (this.subFolders[i].GetFile("config.json") !== undefined) {
                tempS.push(this.subFolders[i]);
            } else {
                tempN.push(this.subFolders[i]);
            }
        }
        this.specialFolders = tempS;
        this.normalFolders = tempN;
    }

    public Delete() {
        const poolFolder = this._pool as DynamicObjectPool<FolderNode>;
        for (let i = 0; i < this.files.length; i++) {
            this.files[i].Delete();
        }
        for (let i = 0; i < this.subFolders.length; i++) {
            this.subFolders[i].Delete();
        }
        Container.getInstance().get(FileServer)!.RemoveInstallModId(this.curPath!);
        poolFolder.FreeObject(this);
    }

    // 删除当前文件夹下的子文件或子文件夹
    public async DeleteSub(name: string): Promise<void> {
        try {
            await this._handle?.removeEntry(name, { recursive: true });

            for (let i = 0; i < this.files.length; i++) {
                if (this.files[i].Name === name) {
                    this.files[i].Delete();
                    this.files.splice(i, 1);
                    break;
                }
            }
            for (let i = 0; i < this.subFolders.length; i++) {
                if (this.subFolders[i].Name === name) {
                    this.subFolders[i].Delete();
                    this.subFolders.splice(i, 1);
                    break;
                }
            }
            this.UpdateFolder();
        } catch (error) {
            console.error(`删除文件或文件夹失败: ${this.curPath}/${name}`, error);
        }
    }

    public async Rename(newName: string): Promise<void> {
        try {
            await Container.getInstance().get(FileServer)!.Rename(this.curPath!, newName);
        } catch (error) {
            console.error(`重命名文件夹失败: ${this.curPath}`, error);
        }
    }
    //禁用所有子文件
    public async DisableAllSubFile() {
        this.files.forEach(async element => {
            if (element.Name && element.Name !== "config.json" && !element.Name.endsWith(".disable") && element.Name !== "详情图.png")
                await element.Rename(element.Name + ".disable");
        });
    }
    //启动所有子文件
    public async EnableAllSubFile() {
        this.files.forEach(async element => {
            if (element.Name && element.Name !== "config.json" && element.Name !== "详情图.png")
                await element.Rename(element.Name.replace(".disable", ""));
        });
    }
    // 获取文件夹名
    get Name(): string | undefined {
        return this._handle?.name;
    }
    public GetHandle(): FileSystemDirectoryHandle | undefined {
        return this._handle;
    }
    public SetHandle(handle: FileSystemDirectoryHandle) {
        this._handle = handle;
    }
}
