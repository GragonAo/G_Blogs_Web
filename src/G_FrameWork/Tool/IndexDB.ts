import { GLObject } from "@/G_FrameWork/Servers/ObjectPool/GLObject";

export class IndexDB extends GLObject {
    private readonly dbName = 'sims-web-db';
    private readonly version = 2;

    private async GetDatabase(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onerror = reject;
            request.onsuccess = (event) => {
                resolve((event.target as IDBRequest).result as IDBDatabase);
            };
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBRequest).result as IDBDatabase;
                if (!db.objectStoreNames.contains('sims-folderhandles-store')) {
                    db.createObjectStore('sims-folderhandles-store');
                }
                if (!db.objectStoreNames.contains('game-version-store')) {
                    db.createObjectStore('game-version-store');
                }
            };
        });
    }

    public async StoreDirectoryHandle(directoryHandle: FileSystemDirectoryHandle): Promise<void> {
        const db = await this.GetDatabase();
        const transaction = db.transaction('sims-folderhandles-store', 'readwrite');
        const store = transaction.objectStore('sims-folderhandles-store');
        return new Promise((resolve, reject) => {
            const request = store.put(directoryHandle, 'directory-handle');
            request.onerror = reject;
            request.onsuccess = () => resolve();
        });
    }

    public async GetStoredDirectoryHandle(): Promise<FileSystemDirectoryHandle | undefined> {
        const db = await this.GetDatabase();
        if (!db) return undefined;
        const transaction = db.transaction('sims-folderhandles-store', 'readonly');
        const store = transaction.objectStore('sims-folderhandles-store');
        return new Promise((resolve, reject) => {
            const request = store.get('directory-handle');
            request.onerror = reject;
            request.onsuccess = (event: any) => resolve(event.target.result);
        });
    }

    public async StoreGameVersion(version: string): Promise<void> {
        const db = await this.GetDatabase();
        const transaction = db.transaction('game-version-store', 'readwrite');
        const store = transaction.objectStore('game-version-store');
        return new Promise((resolve, reject) => {
            const request = store.put(version, 'game-version');
            request.onerror = reject;
            request.onsuccess = () => resolve();
        });
    }

    public async GetGameVersion(): Promise<string | undefined> {
        const db = await this.GetDatabase();
        if (!db) return undefined;
        const transaction = db.transaction('game-version-store', 'readonly');
        const store = transaction.objectStore('game-version-store');
        return new Promise((resolve, reject) => {
            const request = store.get('game-version');
            request.onerror = reject;
            request.onsuccess = (event: any) => resolve(event.target.result);
        });
    }
}