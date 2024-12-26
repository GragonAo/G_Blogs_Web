export class AsyncLock {
    private _locked: boolean = false;
    private _waitQueue: Array<(value: void) => void> = [];

    async lock(): Promise<void> {
        if (!this._locked) {
            this._locked = true;
            return;
        }

        return new Promise<void>(resolve => {
            this._waitQueue.push(resolve);
        });
    }

    unlock(): void {
        if (!this._locked) {
            return;
        }

        if (this._waitQueue.length > 0) {
            // 从等待队列中获取第一个resolve函数并执行
            const resolve = this._waitQueue.shift()!;
            resolve();
        } else {
            this._locked = false;
        }
    }

    get isLocked(): boolean {
        return this._locked;
    }
}