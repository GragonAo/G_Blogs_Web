import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { LoginAuthRs } from '@/API/API_Types/User';

export const useUserStore = defineStore('user', () => {
  const userLoginInfo = ref<LoginAuthRs | undefined>(undefined);
  const setUserInfo = (info: LoginAuthRs) => {
    userLoginInfo.value = info;
    localStorage.setItem('userLoginInfo', JSON.stringify(userLoginInfo.value));
  }
  const getUserInfo = () => {
    return userLoginInfo.value;
  }
  const clearUserInfo = () => {
    userLoginInfo.value = undefined;
    localStorage.removeItem('userLoginInfo');
  };

  const loadUserInfoFromBrowser = () => {
    const storedInfo = localStorage.getItem('userLoginInfo');
    if (storedInfo) {
      userLoginInfo.value = JSON.parse(storedInfo);
    }
  };

  loadUserInfoFromBrowser();

  return {
    getUserInfo,
    setUserInfo,
    clearUserInfo,
  };
});

// 导出时使用 useUserStore
export default useUserStore;