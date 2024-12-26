<!-- FolderDisplay.vue -->
<template>
    <div>
        <!-- 显示文件夹及其内容 -->
        <div v-for="(folder, index) in folders" :key="index">
            <h3>{{ folder.name }}</h3>
            <!-- 遍历文件夹中的文件 -->
            <div v-for="(file, fileIndex) in folder.files" :key="fileIndex">
                <p>{{ file.name }} (文件类型: {{ file.type }})</p>
            </div>
            <!-- 递归显示子文件夹 -->
            <div v-if="folder.subFolders.length">
                <FolderDisplay :folders="folder.subFolders" />
            </div>
        </div>
    </div>
</template>

<script setup>
import { defineProps } from "vue";

// 接收文件夹数据作为props
defineProps({
    folders: Array
});
</script>

<style scoped>
h3 {
    margin-bottom: 5px;
    color: #2c3e50;
}

p {
    margin-left: 20px;
}
</style>