import type { Result } from './API_Types/Base'
import type { Captcha, Email, LoginAuthEamil, LoginAuthPassword, LoginAuthRs, SetPassword } from "./API_Types/User";
import { HttpServer } from '@/G_FrameWork/Servers/Net/HttpServer';
import { Container } from "@/G_FrameWork/Container";

const http = Container.getInstance().get(HttpServer)!;
export const TestHttpAPI = ()=>{
    return http.get<Result<null>>('test');
}

//获取验证码接口
export const GetCaptchaAIP = () => {
    return http.get<Result<Captcha>>('api/v1/index/captcha');
}

//向你的邮箱发送验证码接口
export const SendEmailCaptchaAPI = (data: Email) => {
    return http.post<Result<null>>('api/v1/user/sendEmailCaptcha', data);
}

//登录账户使用密码AIP
export const LoginAuthPasswordAPI = (data: LoginAuthPassword) => {
    return http.post<Result<LoginAuthRs | null>>('api/v1/user/login', data);
}

//登录账户使用邮箱AIP
export const LoginAuthEmailAPI = (data: LoginAuthEamil) => {
    return http.post<Result<LoginAuthRs>>('api/v1/user/auth', data);
}
//设置密码AIP
export const SetAuthPassword = (data: SetPassword) => {
    return http.post<Result<null>>('api/v1/user/setPassword', data);
}