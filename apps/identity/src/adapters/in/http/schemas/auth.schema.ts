import { z } from 'zod';

/*
 * Shape only: types and generous upper bounds against abuse. Business rules (email format,
 * password policy) stay in the domain, so they answer with the domain's error codes.
 */
const email = z.string().max(320);
const password = z.string().max(1024);
const token = z.string().min(1).max(512);

export const RegisterBody = z.object({ email, password });
export const LoginBody = z.object({ email, password });
export const RefreshBody = z.object({ refreshToken: token });
export const LogoutBody = z.object({ refreshToken: token });
export const VerifyEmailBody = z.object({ token });
export const ForgotPasswordBody = z.object({ email });
export const ResetPasswordBody = z.object({ token, newPassword: password });
