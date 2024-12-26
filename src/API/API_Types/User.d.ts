//验证码类型
export type Captcha = {
  key: string;
  base64?: string;
  code?: string;
}

//邮箱类型
export type Email = {
  email: string;
}

//登录类型
export type LoginAuthPassword = {
  email: string;
  password: string;
  captcha: Captcha;
}

export type LoginAuthEamil = {
  email: string;
  emailCaptcha: string;
}

export type LoginAuthRs = {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
}

//设置密码类型
export type SetPassword = {
  password: string;
}