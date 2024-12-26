import { DBPF } from 'dbpf'
import { Server } from '@/G_FrameWork/Servers/Server';
import { Container } from '@/G_FrameWork/Container';
import type { FolderNode } from '@/G_FrameWork/Servers/Files/FileNode';
import type { DynamicObjectPool } from '@/G_FrameWork/Servers/ObjectPool/DynamicObjectPool';
import { DynamicObjectPoolService } from '@/G_FrameWork/Servers/ObjectPool/DynamicObjectPoolService';
import { Package } from '@/G_FrameWork/Servers/Models/Packet';

export class PackageServer extends Server {
    private _packages: Map<string, Map<string, Package>> | undefined;
    private _packagePool: DynamicObjectPool<Package> | undefined;
    private _usePackets: Set<string> | undefined;
    private _isProcessing: boolean = false;

    override Awake(...args: any[]): void {
        this._packages = new Map();
        this._usePackets = new Set();
        this._packagePool = Container.getInstance().get(DynamicObjectPoolService)!.GetPool(Package);
    }
    override BackToPool(): void {
        this._packages!.clear();
    }
    public async UpdataPackage(node: FolderNode): Promise<void> {
        if (this._isProcessing || node === undefined) {
            return;
        }

        try {
            this._isProcessing = true;
            for (const iter of node.files) {
                const content = await iter.GetContent();
                if (content)
                    await this.ProcessFile(node.curPath!, content);
            }
            const map = this._packages!.get(node.curPath!);
            if (map) {
                const toDelete = [];
                // 遍历当前文件夹路径下的所有包，检查它们是否在 _usePackets 中
                for (const iter of map.values()) {
                    if (this._usePackets!.size >0 && !this._usePackets!.has(iter.Name())) {
                        toDelete.push(iter.Name());
                    }
                }

                // 删除不再使用的包，并释放资源
                for (const name of toDelete) {
                    const iter = map.get(name);
                    if (iter) {
                        map.delete(name);
                        this._packagePool?.FreeObject(iter);
                    }
                }
            }
            this._usePackets!.clear();
        } catch {
            return;
        } finally {
            this._isProcessing = false;
        }
    }
    private async ProcessFile(path: string, file: File): Promise<void> {
        try {
            if (!this._packages!.has(path)) {
                this._packages!.set(path, new Map());
            }
            const map = this._packages!.get(path)!;
            const name = file.name.substring(0, file.name.indexOf('.'));

            let pgkObj = map!.get(name);
            if (pgkObj) {
                pgkObj!.fileName = file.name;
                this._usePackets!.add(name);
                return;
            }
            pgkObj = this._packagePool?.MallocObject(50, 0, name);
            if (file.name.includes(".package")) {
                await DBPF.create(file).then(async (dbpf) => {
                    pgkObj!.SetEntryCount(dbpf.table.size);
                    for (const index of dbpf.table.keys()) {
                        await dbpf.table.get(index).then(async (res) => {
                            await pgkObj!.ProcessEntry(res);
                        });
                    }
                });
            }
            this._packages!.get(path)!.set(name, pgkObj!);
            pgkObj!.fileName = file.name;
            this._usePackets!.add(name);
        } catch (error) {
            console.error(`Error processing file: ${file.name}, error: ${error}`);
            return;
        }
    }
    public GetPackages(path: string): Package[] | undefined {
        if (this._packages!.has(path)) {
            return this._packages!.get(path)!.values().toArray();
        }
        return undefined;
    }
}
