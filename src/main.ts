import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'ant-design-vue/dist/reset.css';
import { AppStart } from './G_FrameWork/AppStart'
import Antd from 'ant-design-vue';
const app = createApp(App)
new AppStart()
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.use(Antd)
app.mount('#app')
