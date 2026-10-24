import { Router } from 'express';
import type { Login } from '../../../../application/use-cases/login.use-case.js';
import type { Logout } from '../../../../application/use-cases/logout.use-case.js';
import type { RefreshSession } from '../../../../application/use-cases/refresh-session.use-case.js';
import type { RegisterUser } from '../../../../application/use-cases/register-user.use-case.js';
import type { RequestPasswordReset } from '../../../../application/use-cases/request-password-reset.use-case.js';
import type { ResetPassword } from '../../../../application/use-cases/reset-password.use-case.js';
import type { VerifyEmail } from '../../../../application/use-cases/verify-email.use-case.js';
import {
  ForgotPasswordBody,
  LoginBody,
  LogoutBody,
  RefreshBody,
  RegisterBody,
  ResetPasswordBody,
  VerifyEmailBody,
} from '../schemas/auth.schema.js';

export type AuthUseCases = {
  registerUser: RegisterUser;
  login: Login;
  refreshSession: RefreshSession;
  logout: Logout;
  verifyEmail: VerifyEmail;
  requestPasswordReset: RequestPasswordReset;
  resetPassword: ResetPassword;
};

/** Thin handlers: parse the request, call one use case, translate the result to HTTP. */
export function authRoutes(useCases: AuthUseCases): Router {
  const router = Router();

  // 202 whether or not the email exists (anti-enumeration, ADR 0007).
  router.post('/v1/auth/register', async (req, res) => {
    await useCases.registerUser.execute(RegisterBody.parse(req.body));
    res.status(202).end();
  });

  router.post('/v1/auth/login', async (req, res) => {
    const body = LoginBody.parse(req.body);
    // Without `trust proxy` this is the socket address; revisit when an API gateway is in front.
    const ip = req.ip ?? 'unknown';
    res.json(await useCases.login.execute({ ...body, ip }));
  });

  router.post('/v1/auth/refresh', async (req, res) => {
    res.json(await useCases.refreshSession.execute(RefreshBody.parse(req.body)));
  });

  router.post('/v1/auth/logout', async (req, res) => {
    await useCases.logout.execute(LogoutBody.parse(req.body));
    res.status(204).end();
  });

  router.post('/v1/auth/verify-email', async (req, res) => {
    await useCases.verifyEmail.execute(VerifyEmailBody.parse(req.body));
    res.status(204).end();
  });

  router.post('/v1/auth/forgot-password', async (req, res) => {
    await useCases.requestPasswordReset.execute(ForgotPasswordBody.parse(req.body));
    res.status(202).end();
  });

  router.post('/v1/auth/reset-password', async (req, res) => {
    await useCases.resetPassword.execute(ResetPasswordBody.parse(req.body));
    res.status(204).end();
  });

  return router;
}
