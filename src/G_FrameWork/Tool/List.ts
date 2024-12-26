export class ArrayList<T> {
    private items: T[] = [];

    // 添加元素
    add(item: T): void {
        this.items.push(item);
    }

    // 移除元素
    remove(item: T): boolean {
        const index = this.items.indexOf(item);
        if (index === -1) return false;
        this.items.splice(index, 1);
        return true;
    }

    // 获取元素
    get(index: number): T | undefined {
        return this.items[index];
    }

    // 排序（升序）
    sort(compareFn?: (a: T, b: T) => number): void {
        this.items.sort(compareFn);
    }

    // 获取所有元素
    getAll(): T[] {
        return this.items;
    }
    clear(): void {
        this.items = [];
    }
    // 查找元素
    contains(item: T): boolean {
        return this.items.includes(item);
    }

    // 获取列表长度
    get length(): number {
        return this.items.length;
    }

    // 实现 Symbol.iterator，使 ArrayList 可迭代
    [Symbol.iterator](): Iterator<T> {
        let index = 0;
        const items = this.items;

        return {
            next(): IteratorResult<T> {
                if (index < items.length) {
                    return { value: items[index++], done: false };
                } else {
                    return { value: undefined as any, done: true };
                }
            }
        };
    }
}




class LinkedListNode<T> {
    value: T;
    next: LinkedListNode<T> | null = null;

    constructor(value: T) {
        this.value = value;
    }
}

export class LinkedList<T> {
    private head: LinkedListNode<T> | null = null;
    private _length: number = 0;

    // 添加元素
    add(item: T): void {
        const newNode = new LinkedListNode(item);
        if (!this.head) {
            this.head = newNode;
        } else {
            let current = this.head;
            while (current.next) {
                current = current.next;
            }
            current.next = newNode;
        }
        this._length++;
    }

    // 移除元素
    remove(item: T): boolean {
        if (!this.head) return false;

        // 如果头部节点就是要删除的节点
        if (this.head.value === item) {
            this.head = this.head.next;
            this._length--;
            return true;
        }

        let current = this.head;
        while (current.next && current.next.value !== item) {
            current = current.next;
        }

        if (!current.next) return false; // 找不到元素

        // 移除节点
        current.next = current.next.next;
        this._length--;
        return true;
    }

    // 获取元素
    get(index: number): T | undefined {
        let current = this.head;
        let count = 0;

        while (current) {
            if (count === index) {
                return current.value;
            }
            count++;
            current = current.next;
        }

        return undefined;
    }

    // 排序（升序）
    sort(compareFn?: (a: T, b: T) => number): void {
        if (!this.head || !this.head.next) return;

        let sorted = false;

        while (!sorted) {
            sorted = true;
            let current = this.head;

            while (current.next) {
                if (compareFn ? compareFn(current.value, current.next.value) > 0 : current.value > current.next.value) {
                    [current.value, current.next.value] = [current.next.value, current.value];
                    sorted = false;
                }
                current = current.next;
            }
        }
    }

    // 获取所有元素
    getAll(): T[] {
        const result: T[] = [];
        let current = this.head;
        while (current) {
            result.push(current.value);
            current = current.next;
        }
        return result;
    }

    // 查找元素
    contains(item: T): boolean {
        let current = this.head;
        while (current) {
            if (current.value === item) return true;
            current = current.next;
        }
        return false;
    }

    // 获取列表长度
    get length(): number {
        return this._length;  // 直接返回保存的长度
    }
}

