import useUserStore from "@/stores/User";
import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type AxiosError, type InternalAxiosRequestConfig, type AxiosProgressEvent } from "axios";
import { APP_CONFIG } from '~/app.config';
import { Server } from "@/G_FrameWork/Servers/Server";
import router from "@/router";
import { ElNotification } from "element-plus";

export class HttpServer extends Server {
  private axiosInstance: AxiosInstance;

  constructor() {
    super();
    this.axiosInstance = axios.create({
      withCredentials: true // 允许跨域请求携带凭证
    });
    this.init();
  }

  private init() {
    // 使用箭头函数绑定this
    this.axiosInstance.interceptors.request.use(
      (config: AxiosRequestConfig<any>): InternalAxiosRequestConfig<any> => {
        if (!config.url) {
          throw new Error('config.url is undefined');
        }
        if (!config.url.startsWith('http')) {
          config.url = `${APP_CONFIG.baseURL}${config.url}`;
        }

        config.timeout = 20000;
        config.headers = {
          ...config.headers,
          'Authorization': this.getAuthorizationHeader(),
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json;charset=utf-8',
        };
        return config as InternalAxiosRequestConfig<any>;
      },
      (error: any) => {
        console.error('Request error:', error);
        return Promise.reject(error);
      }
    );

    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        if (response.data.code === 40001) {  // token过期
          useUserStore().clearUserInfo();
          ElNotification({
            title: '请登录后使用',
            type: 'warning',
          })
          setTimeout(() => router.push('/login'), 1000)
          const errorMessage = response.data.msg || '未知错误';
          return Promise.reject(new Error(errorMessage));
        }
        else if (response.data.code !== 1) {
          const errorMessage = response.data.msg || '未知错误';
          return Promise.reject(new Error(errorMessage));
        }
        return response;
      },
      (error: AxiosError) => {
        console.error('Response error:', error);
        return Promise.reject(error.response?.data || error);
      }
    );
  }

  public getAuthorizationHeader(): string {
    const loginInfo = useUserStore().getUserInfo();
    return loginInfo ? `${loginInfo.token_type} ${loginInfo.access_token}` : '';
  }

  public get<T = any>(url: string, params?: Record<string, any>, config?: AxiosRequestConfig): Promise<T | undefined> {
    return this.axiosInstance.get<T>(url, { ...config, params }).then((response: AxiosResponse<T>) => response.data);
  }

  public post<T = any, D = any>(url: string, data: D, config?: AxiosRequestConfig<any>): Promise<T | undefined> {
    return this.axiosInstance.post<T>(url, data, config).then((response: AxiosResponse<T>) => response.data);
  }

  public put<T = any, D = any>(url: string, data?: D, config?: AxiosRequestConfig<any>): Promise<T | undefined> {
    return this.axiosInstance.put<T>(url, data, config).then((response: AxiosResponse<T>) => response.data);
  }

  public delete<T = any>(url: string, config?: AxiosRequestConfig<any>): Promise<T | undefined> {
    return this.axiosInstance.delete<T>(url, config).then((response: AxiosResponse<T>) => response.data);
  }
}
