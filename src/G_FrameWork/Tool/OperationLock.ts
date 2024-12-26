export class OperationLock {
    private isLocked = false;
    public waitQueue: Array<{ resolve: () => void, priority: number, owner: any }> = [];
    private lockCount = 0;  // 计数器
    public currentOwner: any = null;  // 当前持有锁的操作

    async Lock(owner: any, priority: number = 0) {
        if (!this.isLocked || this.currentOwner === owner) {
            // 锁没有被占用或当前操作就是持有者
            this.isLocked = true;
            this.currentOwner = owner;
            this.lockCount++;
            // console.log(`锁已被占用: owner=${owner}, lockCount=${this.lockCount}`);
            return;
        }
        return new Promise<void>((resolve) => {
            // 在队列中存入操作和优先级
            this.waitQueue.push({ resolve, priority, owner });
            // 按照优先级排序，优先级高的排在前面
            this.waitQueue.sort((a, b) => b.priority - a.priority);
            // console.log(`操作已加入等待队列: owner=${owner}, priority=${priority}`);
        });
    }

    Unlock(owner: any) {
        if (this.currentOwner !== owner) {
            // console.warn(`尝试解锁失败: owner=${owner}, currentOwner=${this.currentOwner}`);
            return; // 只有持有锁的操作才能解锁
        }

        this.lockCount--;
        // console.log(`锁计数器减少: owner=${owner}, lockCount=${this.lockCount}`);
        if (this.lockCount <= 0) {
            this.lockCount = 0;
            if (this.waitQueue.length > 0) {
                // 按照优先级顺序释放锁
                const next = this.waitQueue.shift();
                this.currentOwner = next?.owner;
                // console.log(`锁已转移到下一个操作: owner=${this.currentOwner}`);
                next?.resolve(); // 执行下一个操作
            } else {
                this.isLocked = false;
                this.currentOwner = null;
                // console.log(`锁已释放: owner=${owner}`);
            }
        }
    }

    public Reset() {
        this.isLocked = false;
        this.waitQueue = [];
        this.lockCount = 0;
        this.currentOwner = null;
        console.log(`锁已重置`);
    }

    get isLocking() {
        return this.isLocked;
    }
}