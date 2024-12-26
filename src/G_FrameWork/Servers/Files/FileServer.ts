import { FileNode, FolderNode } from "./FileNode";
import JSZip from "jszip";
import { v4 as uuidv4 } from 'uuid';
import { ConfigJsonToPath, type ConfigJson, type ContentType } from "./ConfigJson";
import { IndexDB } from "../../Tool/IndexDB";
import { GLObject } from "../ObjectPool/GLObject";
import type { DynamicObjectPool } from "../ObjectPool/DynamicObjectPool";
import { Container } from "@/G_FrameWork/Container";
import { DynamicObjectPoolService } from "../ObjectPool/DynamicObjectPoolService";
import { CommandServer } from "../CommandServer";
import { EventServer } from "../Event/EventServer";
import { OperationLock } from "@/G_FrameWork/Tool/OperationLock";
import { TaskServer } from "../TaskServer/TaskServer";
type FileStatus =
    "空闲" | "初始化" | "轮询" | "创建文件夹" | "创建文件" | "删除" | "获取文件夹" | "获取文件" | "移动" | "重命名" | "解压中" | "Json读取";
export class FileServer extends GLObject {
    private _rootNode: FolderNode | undefined;
    // private _downTaskMananger: DownloadManager | undefined;
    private _intervalId: NodeJS.Timeout | undefined = undefined;  // 存储定时任务的ID
    private _operationLock: OperationLock;       // 状态管理
    private _indexDB: IndexDB | undefined;
    private _eventServer: EventServer | undefined;
    private _filePool: DynamicObjectPool<FileNode> | undefined;
    private _folderPool: DynamicObjectPool<FolderNode> | undefined;
    private _nodeCount = 0;
    private _fileCount = 0;
    private _folderCount = 0;
    private _installModCount = 0;
    private _curStatus: FileStatus = "空闲";
    private _lastUpdateElapsedTime: number = 0;
    public installModId: Map<string, Set<ConfigJson>>;
    public initComplete = false;

    constructor() {
        super();
        this._rootNode = undefined;
        this.installModId = new Map();
        this._operationLock = new OperationLock();
    }
    override Awake(...args: any[]): void {
        this._filePool = Container.getInstance().get(DynamicObjectPoolService)!.GetPool(FileNode);
        this._folderPool = Container.getInstance().get(DynamicObjectPoolService)!.GetPool(FolderNode);
        this._indexDB = Container.getInstance().get(IndexDB);
        this._eventServer = Container.getInstance().get(EventServer);
        Container.getInstance().get(CommandServer)?.registerCommand("files -all", this.Show.bind(this));
    }
    override BackToPool(): void {
        this._rootNode = undefined;
        this._indexDB = undefined;
        this._filePool = undefined;
        this._folderPool = undefined;
        this.initComplete = false;
        this.installModId.clear();
        this._nodeCount = 0; this._fileCount = 0; this._folderCount = 0; this._installModCount = 0;
        this._curStatus = "空闲"
    }

    private async WithLoading(action: () => Promise<void>, status: FileStatus, callerId: string | undefined = undefined, priority: number = 0) {
        let owner = callerId;  // 使用 UUID 或传入的 callerId 作为 owner
        if (callerId === undefined) owner = uuidv4();
        const isTopLevel = (callerId === undefined);  // 如果没有 callerId，说明是顶层调用
        try {
            // 获取锁，传递 owner 和优先级
            if (isTopLevel) {
                // console.log(`尝试获取锁: owner=${owner}, priority=${priority}, status=${status}`);
                await this._operationLock.Lock(owner, priority);
                // console.log(`成功获取锁: owner=${owner}, status=${status}`);
            }
            this._curStatus = status;
            // 执行操作，传递相同的 callerId 给递归调用以保持追踪
            await action();
        } catch (error) {
            console.error(`操作失败: owner=${owner}, error=${error}`);
            throw error;
        } finally {
            // 释放锁，传递相同的 owner
            if (isTopLevel) {
                // console.log(`尝试释放锁: owner=${owner}, status=${status}`);
                this._operationLock.Unlock(owner);
                // console.log(`成功释放锁: owner=${owner}, status=${status}`);
            }
            if (!this._operationLock.isLocking) {
                this._curStatus = '空闲';
                // console.log(`当前状态: 空闲`);
            } else {
                // console.log(`当前锁状态: 已锁定, 当前持有锁的操作: ${this._operationLock.currentOwner}`);
                // console.log(`等待队列长度: ${this._operationLock.waitQueue.length}`);
                // this._operationLock.waitQueue.forEach((item, index) => {
                //     console.log(`  ${index + 1}. 优先级: ${item.priority}, 操作: ${item.owner}`);
                // });
            }
        }
    }

    private ResetData() {
        this._nodeCount = 1; this._fileCount = 0; this._folderCount = 1; this._installModCount = 0;
        this.installModId.clear();
        for (const iter of this.installModId.values()) {
            iter.clear();
        }
    }

    public async Init(directoryHandle: FileSystemDirectoryHandle) {
        try {
            if (directoryHandle === undefined) {
                console.error('无效的 directoryHandle');
                return;
            }
            console.log("初始化文件管理器");
            this.initComplete = true;
            await this.StopUpdate();
            this._operationLock.Reset();
            // 1. 清除之前的结构和定时任务
            if (this._rootNode) {
                this._rootNode.Delete();
                this._intervalId = undefined;
            }
            this._rootNode = this._folderPool?.MallocObject(50, 0, directoryHandle, "/");
            this._nodeCount = 1;
            // 2. 开始初始化新的文件管理器
            await this._indexDB?.StoreDirectoryHandle(directoryHandle); // 存储新的目录��柄

            this.ResetData();
            console.time('First buildStructure');
            await this.BuildStructure(this._rootNode!);  // 不传递 callerId，让它生成新的
            console.timeEnd('First buildStructure');

            console.time('startUpdate');
            await this.StartUpdate();
            console.timeEnd('startUpdate');
        } catch (error) {
            this.initComplete = false;
            console.error("初始化文件管理器失败:", error);
            throw new Error("初始化文件管理器失败");
        }
    }
    private WaitForUnlock(): Promise<void> {
        return new Promise((resolve) => {
            const checkLock = () => {
                if (!this._operationLock.isLocking) {
                    resolve();
                } else {
                    setTimeout(checkLock, 100);
                }
            };
            checkLock();
        });
    }

    public async StartUpdate() {
        const pollId = uuidv4(); // 生成轮询ID
        this._eventServer?.Send("FileUpdate");
        console.log(`文件系统开启更新, ID: ${pollId}`);
        this._intervalId = setInterval(async () => {
            if (!this._operationLock.isLocking) {
                this.ResetData();
                const startTime = performance.now();
                await this.BuildStructure(this._rootNode!, pollId);
                this._eventServer?.Send("FileUpdate");
                const endTime = performance.now();
                this._lastUpdateElapsedTime = endTime - startTime;
            }
        }, 3000);
    }

    public async StopUpdate() {
        if (this._intervalId !== undefined) {
            const stopId = uuidv4();
            console.log(`准备停止文件系统更新, ID: ${stopId}`);
            await this.WaitForUnlock(); // 等待当前操作完成
            clearInterval(this._intervalId);
            this._intervalId = undefined;
            console.log(`文件系统更新已停止, ID: ${stopId}`);
        }
    }

    private async BuildStructure(folderNode: FolderNode, callerId?: string) {
        const currentId = callerId || uuidv4(); // 如果是顶层调用，生成新的UUID
        // console.log(`开始构建文件夹: ${folderNode.curPath}, ID: ${currentId}`);
        try {
            await this.WithLoading(async () => {
                let allItemNames = new Set<string>();

                // 遍历文件夹内容
                for await (const entry of (folderNode.GetHandle() as any).values()) {
                    if (entry.kind === "file" && (entry.name.includes(".crswap") || entry.name.includes(".DS_Store"))) continue;
                    if (folderNode.GetSN() === this._rootNode?.GetSN() && entry.name === this._rootNode.Name) continue;
                    if (entry.name === folderNode.Name) continue;
                    allItemNames.add(entry.name);
                    if (entry.kind === "file") {
                        // 处理文件
                        let fileItem = await folderNode.GetFile(entry.name);
                        if (fileItem === undefined) {
                            fileItem = this._filePool?.MallocObject(50, 0, entry, folderNode.curPath);
                            folderNode.files.push(fileItem!);
                        }
                        if (fileItem === undefined) return;
                        fileItem!.UpdateNode(entry as FileSystemFileHandle, folderNode.curPath!);

                        // 处理 config.json
                        if (fileItem.Name === 'config.json') {
                            const json = await this.ReadConfigFile(fileItem);
                            if (json) {
                                const path = folderNode.curPath?.substring(0, folderNode.curPath.lastIndexOf("/"));
                                if (path === undefined) continue;
                                const jsonPath = fileItem.curPath?.substring(0, fileItem.curPath.lastIndexOf("/"));
                                if (json.modPath !== jsonPath) {
                                    json.modPath = jsonPath!;
                                    await this.WriteJson(fileItem, json);
                                }
                                if (!this.installModId.has(path)) {
                                    this.installModId.set(path, new Set());
                                }
                                this.installModId.get(path)?.add(json);
                                this._installModCount++;
                                // console.log(`在 ${path} 已找到配置文件: ${folderNode.Name}`);
                            }
                        }
                    } else if (entry.kind === "directory") {
                        // 处理子文件夹
                        let folderItem = await folderNode.GetFolder(entry.name);
                        if (folderItem === undefined) {
                            folderItem = this._folderPool?.MallocObject(50, 0, entry, folderNode.curPath);
                            folderNode.subFolders.push(folderItem!);
                        }
                        if (folderItem === undefined) return;
                        folderItem.updateNode(entry as FileSystemDirectoryHandle, folderNode.curPath!);

                        // 递归构建子文件夹，传递相同的 callerId
                        await this.BuildStructure(folderNode.GetFolder(entry.name)!, currentId);
                    }
                }

                // 清理不存在的文件
                const filesToRemove = folderNode.files.filter(file => !allItemNames.has(file.Name!));
                for (const file of filesToRemove) {
                    file.Delete();
                }
                folderNode.files = folderNode.files.filter(file => allItemNames.has(file.Name!));

                // 清理不存在的文件夹
                const foldersToRemove = folderNode.subFolders.filter(folder => !allItemNames.has(folder.Name!));
                for (const folder of foldersToRemove) {
                    folder.Delete();
                }
                folderNode.subFolders = folderNode.subFolders.filter(folder => allItemNames.has(folder.Name!));

                folderNode.UpdateFolder();
                this._fileCount += folderNode.files.length;
                this._folderCount += folderNode.subFolders.length;
                this._nodeCount += folderNode.files.length + folderNode.subFolders.length;
            }, '轮询', currentId); // 传递 currentId 给 WithLoading
        } catch (error) {
            console.error(`构建文件夹结构时出错: ${folderNode.curPath}, ID: ${currentId}`, error);
            throw new Error(`构建文件夹结构时出错: ${folderNode.curPath}`);
        }
    }

    public async GetFolderByPath(path: string): Promise<FolderNode | undefined> {
        try {
            if (this._rootNode === undefined) return undefined;
            // 如果路径是根路径，则返回根文件夹
            if (path === "/") return this._rootNode;
            // 替换路径中的根文件夹名称
            path = path.replace(this._rootNode.Name!, "/");
            const parts = path.split('/').filter(Boolean);
            let currentNode: FolderNode | undefined = this._rootNode;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                // 如果已经到达路径的最后一个部分，尝试返回文件节点
                if (i === parts.length - 1) {
                    const fileNode = currentNode?.GetFile(part);
                    if (fileNode) {
                        return currentNode; // 找到文件时返回上级文件夹
                    }
                }
                // 如果当前节点为空，或者没有找到该部分的文件夹，直接返回 undefined
                if (!currentNode) return undefined;
                // 获取下一个文件夹节点
                const nextNode = currentNode.GetFolder(part);
                //如果为空说明不存在
                if (!nextNode) {
                    return undefined;
                }
                currentNode = nextNode;
            }
            return currentNode;
        } catch (error) {
            console.error("获取文件夹路径时出错:", path, error);
            return undefined;
        }
    }

    public async GetFileByPath(path: string): Promise<FileNode | undefined> {
        try {
            const parts = path.split('/').filter(Boolean);
            const name = parts.pop();
            if (name) {
                const dir = await this.GetFolderByPath(path);
                return dir?.GetFile(name);
            }
            return undefined;
        } catch (error) {
            return undefined;
        }
    }

    public async CreateFolder(path: string): Promise<FolderNode | undefined> {
        try {
            if (this._rootNode === undefined) {
                console.error("游戏所在文件夹还没有配置");
                return undefined;
            }
            if (path === undefined || path === "") return undefined;
            if (path.startsWith('/')) {
                path = path.substring(1);
            }
            const parts = path.split('/');
            let currentNode: FolderNode | undefined = this._rootNode;
            console.log(`开始创建文件夹路径: ${path}`);
            await this.WithLoading(async () => {
                console.log("获取到锁资源，进行创建文件夹")
                for (const part of parts) {
                    if (!currentNode) return undefined;
                    let subFolder = currentNode.GetFolder(part);
                    if (!subFolder) {
                        console.log(`创建子文件夹: ${part}`);
                        subFolder = await currentNode.CreateFolder(part);
                    } else {
                        console.log(`子文件夹已存在: ${part}`);
                    }
                    currentNode = subFolder;
                }
            }, '创建文件夹', undefined);
            console.log(`文件夹创建完成: ${path}`);
            return currentNode;
        } catch (error) {
            console.error("创建文件夹时出错:", path, error);
            return undefined;
        }
    }

    public async CreateFile(path: string, fileName: string, content: ContentType | undefined): Promise<void> {
        try {
            if (path === undefined || path === "" || content === undefined) return;
            // 获取文件夹路径和文件夹名称
            const parts = path.split('/').filter(Boolean);
            const folderPath = parts.join('/');  // 获取完整的文件夹路径
            let folder = await this.GetFolderByPath(folderPath);
            if (!folder) {
                // 如果文件夹不存在，自动创建所有缺失的文件夹层级
                folder = await this.CreateFolder(folderPath);
            }
            console.log("创建文件--------->"+ fileName);
            // 创建目标文件
            if (!folder) {
                throw new Error(`文件夹路径 ${folderPath} 仍然不存在`);
            }
            await this.WithLoading(async () => {
                await folder.CreateFile(fileName, content);
            }, '创建文件', undefined, 1)
            console.log(`文件 ${fileName} 已成功创建在 ${folder.curPath}`);
        } catch (error) {
            console.error("创建文件时出错:", path, error);
            throw new Error(`创建文件时出错: ${path}`);
        }
    }

    public async GetFileContent(path: string): Promise<File | undefined> {
        try {
            let res;
            await this.WithLoading(async () => {
                const parts = path.split('/').filter(Boolean);
                const folderPath = parts.slice(0, -1).join('/');
                const fileName = parts.pop();
                const folder = folderPath === "" ? this._rootNode : await this.GetFolderByPath(folderPath);
                if (folder === undefined) return undefined;
                const file = folder.GetFile(fileName || "");
                res = file ? await file.GetContent() : undefined;
            }, '获取文件', undefined, 1)
            return res;
        } catch (error) {
            console.error("获取文件内容时出错:", path, error);
            return undefined;
        }
    }

    public async UpdateFileContent(path: string, newContent: ContentType): Promise<void> {
        try {
            await this.WithLoading(async () => {
                const parts = path.split('/');
                const folderPath = parts.slice(0, -1).join('/');
                const fileName = parts.pop();

                const folder = await this.GetFolderByPath(folderPath);
                const file = folder?.GetFile(fileName || "");
                if (file) {
                    await file.UpdateContent(newContent);
                } else {
                    throw new Error(`文件 ${fileName} 不存在`);
                }
            }, '获取文件', undefined, 1)
        } catch (error) {
            console.error("更新文件内容时出错:", path, error);
            throw new Error(`更新文件内容时出错: ${path}`);
        }
    }

    // 解压文件并更新下载任务状态
    public async ExtractZipFile(zipBlob: Blob, folderPath: string, taskId: number): Promise<void> {
        const taskServer = Container.getInstance().get(TaskServer);
        const task = taskServer?.GetTask(taskId);
        try {
            // 更新任务状态
            if (task) {
                task.progress = 0;
            }
            console.log(`文件系统开始解压工作，任务ID=${task?.id}，数据大小=${zipBlob.size}`);

            // 解压 zip 文件并创建目标文件夹
            const zip = await JSZip.loadAsync(zipBlob);
            const parts = folderPath.split('/').filter(Boolean);
            folderPath = parts.join('/');  // 获取完整的文件夹路径
            console.log(`目标文件夹路径：${folderPath}`);

            const folderNode = await this.CreateFolder(folderPath);
            if (!folderNode) {
                task!.status = 'Failed';
                throw new Error(`无法创建文件夹 ${folderPath}`);
            }
            this.WithLoading(async () => {
                const totalFiles = Object.keys(zip.files).length;
                let filesProcessed = 0;
                console.log(`总文件数：${totalFiles}`);

                for (const [fileName, file] of Object.entries(zip.files)) {
                    if (file.dir) continue;

                    const pathParts = fileName.split("/");
                    const fileNameOnly = pathParts.pop();
                    let currentFolderNode = folderNode;

                    for (const part of pathParts) {
                        let subFolderNode = currentFolderNode.GetFolder(part);
                        if (!subFolderNode) {
                            subFolderNode = await currentFolderNode.CreateFolder(part);
                            if (!subFolderNode) {
                                throw new Error(`创建子文件夹失败: ${part}`);
                            }
                            console.log(`创建子文件夹：${part}`);
                        }
                        currentFolderNode = subFolderNode;
                    }
                    const fileBlob = await file.async("blob");
                    await currentFolderNode.CreateFile(fileNameOnly!, fileBlob);
                    console.log(`文件 ${fileNameOnly} 已解压并保存到 ${currentFolderNode.curPath}`);

                    // 更新进度
                    filesProcessed++;
                    const progress = Math.round((filesProcessed / totalFiles) * 100);
                    if (task) {
                        task.progress = progress;
                        console.log(`任务进度：${progress}%`);
                    }
                }
                console.log(`文件夹 ${folderPath} 已解压并保存`);
            }, '解压中', undefined, 1);
        } catch (error) {
            console.error("解压 ZIP 文件时出错:", folderPath, error);
            if (task) {
                task.status = 'Failed';
            }
            throw new Error(`解压 ZIP 文件时出错: ${folderPath}`);
        }
    }

    public async Delete(path: string): Promise<void> {
        try {
            // 获取路径的父文件夹
            const parts = path.split('/').filter(Boolean);
            const fileName = parts.pop(); // 最后一个部分是文件或文件夹的名称
            const parentFolderPath = parts.join('/'); // 剩下的部分是父文件夹的路径
            await this.WithLoading(async () => {
                const parentFolder = await this.GetFolderByPath(parentFolderPath);
                if (!parentFolder) {
                    throw new Error(`父文件夹路径 ${parentFolderPath} 不存在`);
                }
                // 如果找到了父文件夹，进行删除操作
                if (fileName) {
                    // 删除文件或文件夹
                    await parentFolder.DeleteSub(fileName);
                    console.log(`已删除: ${fileName} 在 ${parentFolderPath}`);
                } else {
                    console.warn(`传递的路径无效，无法删除文件或文件夹: ${path}`);
                }
            }, '删除', undefined, 1)
        } catch (error) {
            console.error("删除文件或文件夹时出错:", path, error);
            throw new Error(`删除文件或文件夹时出错: ${path}`);
        }
    }

    public async Rename(path: string, newName: string): Promise<void> {
        try {
            const parts = path.split('/').filter(Boolean);
            const folderPath = parts.slice(0, -1).join('/');
            const oldName = parts.pop();
            await this.WithLoading(async () => {
                const folder = await this.GetFolderByPath(folderPath);

                if (!folder) throw new Error(`文件夹路径 ${folderPath} 不存在`);

                if (oldName) {
                    const file = folder.GetFile(oldName);
                    if (file) {
                        file.Rename(newName);
                        return;
                    }

                    const subFolder = folder.GetFolder(oldName);
                    if (subFolder) {
                        const newFolderNode = await folder.CreateFolder(newName);
                        if (newFolderNode === undefined) return;
                        await this.CopyFolderContents(subFolder, newFolderNode);
                        folder.DeleteSub(oldName); // 删除旧文件夹引用
                        return;
                    }

                    throw new Error(`文件或文件夹 ${oldName} 不存在`);
                }
            }, '重命名', undefined, 1)
        } catch (error) {
            console.error("重命名文件或文件夹时出错:", path, error);
            throw new Error(`重命名文件或文件夹时出错: ${path}`);
        }
    }

    private async CopyFolderContents(sourceFolder: FolderNode, targetFolder: FolderNode): Promise<void> {
        try {
            for (const file of sourceFolder.files) {
                if (file.Name!.includes(".crswap")) continue;
                const content = await file.GetContent();
                await targetFolder.CreateFile(file.Name!, content!);
            }
            for (const subFolder of sourceFolder.subFolders) {
                const newSubFolderNode = await targetFolder.CreateFolder(subFolder.Name!);
                if (newSubFolderNode === undefined) return;
                await this.CopyFolderContents(subFolder, newSubFolderNode);
            }
        } catch (error) {
            console.error("复制文件夹内容时出错:", sourceFolder.curPath, targetFolder.curPath, error);
            throw new Error(`复制文件夹内容时出错: ${sourceFolder.curPath}`);
        }
    }

    public async Move(sourcePath: string, targetPath: string, newName?: string): Promise<void> {
        try {
            console.log(sourcePath)
            console.log(targetPath)

            if (targetPath.startsWith(sourcePath)) return;
            if (sourcePath.substring(0, sourcePath.lastIndexOf('/')) === targetPath) return;
            const sourceParts = sourcePath.split('/').filter(Boolean);
            const targetParts = targetPath.split('/').filter(Boolean);
            const sourceName = sourceParts.pop();
            if (!sourceName) throw new Error(`无效的源路径 ${sourcePath}`);
            await this.WithLoading(async () => {
                const sourceFolder = await this.GetFolderByPath(sourceParts.join('/'));
                if (!sourceFolder) throw new Error(`源文件夹路径 ${sourceParts.join('/')} 不存在`);
                if (!sourceFolder.GetFile(sourceName) && !sourceFolder.GetFolder(sourceName)) {
                    throw new Error(`源文件夹路径 ${sourceParts.join('/')} 不存在`);
                }
                let targetFolder = await this.GetFolderByPath(targetParts.join('/'));

                if (!targetFolder) {
                    console.log(`目标文件夹路径 ${targetParts.join('/')} 不存在，正在创建`);
                    targetFolder = await this.CreateFolder(targetPath);
                }

                if (!targetFolder) return;

                newName = newName || sourceName;
                const fileNode = sourceFolder.GetFile(sourceName);
                if (fileNode) {
                    await fileNode.Move(targetFolder, newName);
                    const index = sourceFolder.files.indexOf(fileNode);
                    if (index !== -1) {
                        sourceFolder.files.splice(index, 1);  // 删除该元素
                    }
                } else {
                    const subFolderNode = sourceFolder.GetFolder(sourceName);
                    if (subFolderNode) {
                        const newFolderNode = await targetFolder.CreateFolder(newName);
                        if (newFolderNode === undefined) return;
                        await this.CopyFolderContents(subFolderNode, newFolderNode);
                        await sourceFolder.DeleteSub(sourceName);
                        console.log(`文件夹 ${sourceName} 已成功移动`);
                    } else {
                        throw new Error(`文件或文件夹 ${sourceName} 不存在`);
                    }
                }
            }, '移动', undefined, 1)
        } catch (error) {
            throw new Error(`移动文件或文件夹时出错: ${sourcePath} 到 ${targetPath}`);
        }
    }

    public WriteJson = async (file: FileNode, configJson: ConfigJson): Promise<boolean> => {
        try {
            const jsonString = JSON.stringify(configJson, null, 2); // 格式化 JSON 字符串
            await file.UpdateContent(jsonString);  // 写入文件
            this.RemoveInstallModId(ConfigJsonToPath(configJson));
            this.AddInstallModId(configJson);
            return true;  // 返回写入成功
        } catch (error) {
            console.error("写入配置文件时出错", error);
            return false;  // 写入失败，返回 false
        }
    };

    // 读取 JSON 配置文件内容
    public ReadConfigFile = async (file: FileNode): Promise<ConfigJson | undefined> => {
        try {
            if (!file) return undefined;
            let parsedData;
            await this.WithLoading(async () => {

                const fileContent = await file.GetContent();  // 获取文件对象内容
                const str = await fileContent?.text();
                if (str) {
                    parsedData = JSON.parse(str); // 解析 JSON 内容
                }
            }, 'Json读取', undefined, 1)
            if (parsedData) {
                return parsedData as ConfigJson;  // 返回正确类型的配置数据
            }
        } catch (error) {
            console.warn("读取配置文件时出错", error);
            return undefined;
        }
        return undefined;
    };

    public PathTotName(path: string): string {
        if (path === undefined || path === "") return "";
        const r = path.lastIndexOf("/") + 1;
        if (r < path.length)
            return path.substring(r, path.length);
        return "";
    }

    public AddInstallModId(config: ConfigJson) {
        const cPath = ConfigJsonToPath(config);
        const path = cPath.substring(0, cPath.lastIndexOf("/"));
        if (!this.installModId.has(path)) {
            this.installModId.set(path, new Set());
        }
        this.installModId.get(path)?.add(config);
    }
    // 判断是否已安装及其状态
    public HasModAndStatus(modId: string): ConfigJson | undefined {
        for (const iter of this.installModId.values()) {
            for (const config of iter) {
                if (config.modId === modId) {
                    return config;
                }
            }
        }
        return undefined;
    }
    public GetInstallConfigSet(path: string): Set<ConfigJson> | undefined {
        return this.installModId.get(path)!;
    }
    public RemoveInstallModId(path: string) {
        try {
            const setPath = path.substring(0, path.lastIndexOf("/"));
            const name = path.substring(path.lastIndexOf("/") + 1, path.length);
            if (this.installModId.has(setPath)) {
                for (const iter of this.installModId.get(setPath)!) {
                    if (iter.modName === name) {
                        this.installModId.get(setPath)?.delete(iter);
                        break;
                    }
                }
            }
        } catch (e: any) {
            console.error(e.message);
        }
    }
    public Show() {
        const title = " 文件管理服务状态 ";
        const statusLine = `状态: ${this.colorizeStatus(this._curStatus)}`;
        const nodeCountLine = `节点数量: ${this.colorizeNodeCount(this._nodeCount)}`;
        const fileCount = `文件数量: ${this.colorizeNodeCount(this._fileCount)}`;
        const folderCount = `文件夹数量: ${this.colorizeNodeCount(this._folderCount)}`;
        const installModCount = `安装模组数量: ${this.colorizeNodeCount(this._installModCount)}`;
        const lockStatusLine = `锁状态: ${this.colorizeLockState(this._operationLock.isLocking)}`;
        const elapsedTimeLine = `上次轮询耗费: ${this.colorizeElapsedTime(this._lastUpdateElapsedTime)}`;

        // Calculate the longest content line
        const contentLines = [statusLine, nodeCountLine, fileCount, folderCount, installModCount, lockStatusLine, elapsedTimeLine];
        const maxContentWidth = Math.max(...contentLines.map(line => this.stripColor(line).length));
        const boxWidth = Math.max(maxContentWidth, title.length) + 4; // Add padding

        // Generate the box
        const horizontalLine = "─".repeat(boxWidth);
        const emptyLine = `│${" ".repeat(boxWidth)}│`;

        console.log(`\n╭${horizontalLine}╮`);
        console.log(`│${title.padStart((boxWidth + title.length) / 2).padEnd(boxWidth)}│`);
        console.log(`├${horizontalLine}┤`);
        console.log(emptyLine);
        for (const line of contentLines) {
            console.log(`│ ${line.padEnd(boxWidth - 2)} │`);
        }
        console.log(emptyLine);
        console.log(`╰${horizontalLine}╯\n`);
            // 如果锁定，打印锁的内部数据
    if (this._operationLock.isLocking) {
        console.log("锁定状态详细信息:");
        console.log(`当前持有锁的操作: ${this._operationLock.currentOwner}`);
        console.log(`等待队列长度: ${this._operationLock.waitQueue.length}`);
        console.log("等待队列:");
        this._operationLock.waitQueue.forEach((item, index) => {
            console.log(`  ${index + 1}. 优先级: ${item.priority}, 操作: ${item.owner}`);
        });
    }
    }

    // Add colorization methods
    private colorizeStatus(status: string): string {
        const color = status === "空闲" ? "\x1b[32m" : "\x1b[33m"; // Green for idle, Yellow for busy
        return `${color}${status}\x1b[0m`;
    }

    private colorizeNodeCount(count: number): string {
        const color = count > 0 ? "\x1b[36m" : "\x1b[31m"; // Cyan for >0, Red for 0
        return `${color}${count}\x1b[0m`;
    }

    private colorizeLockState(isLocked: boolean): string {
        const color = isLocked ? "\x1b[31m" : "\x1b[32m"; // Red for locked, Green for unlocked
        return `${color}${isLocked ? "已锁定" : "未锁定"}\x1b[0m`;
    }

    private colorizeElapsedTime(elapsedTime: number): string {
        const color = elapsedTime < 1000 ? "\x1b[32m" : "\x1b[33m"; // Green for <1s, Yellow for >=1s
        return `${color}${elapsedTime.toFixed(2)} ms\x1b[0m`;
    }

    private stripColor(input: string): string {
        return input.replace(/\x1b\[[0-9;]*m/g, "");
    }

}
