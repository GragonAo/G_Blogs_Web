import { ElLoading } from "element-plus";
import { ref } from "vue";

const loadingShow = ref();
let startTime = 0;
let endTime = 0;
let loadingQueue: { text: string, resolve: () => void }[] = [];
let isLoading = false;

const processQueue = async () => {
    if (isLoading || loadingQueue.length === 0) return;
    
    isLoading = true;
    const current = loadingQueue[0];
    
    startTime = performance.now();
    loadingShow.value = ElLoading.service({
        lock: true,
        text: current.text + " 操作完成前请不要刷新页面",
        background: 'rgba(0, 0, 0, 0.7)'
    });
}

export const LoadingShow = (loadingText: string): Promise<void> => {
    return new Promise((resolve) => {
        loadingQueue.push({ text: loadingText, resolve });
        processQueue();
    });
}

export const LoadingHide = (timeOut: number = 0) => {
    endTime = performance.now();
    const wait = Math.max(timeOut - (endTime - startTime), 0);
    
    setTimeout(() => {
        if (loadingShow.value) {
            loadingShow.value.close();
            if(loadingQueue.length>0){
                loadingQueue[0].resolve();
                loadingQueue.shift();
                isLoading = false;
                processQueue(); // 处理队列中的下一个请求
            }
        }
    }, wait);
}