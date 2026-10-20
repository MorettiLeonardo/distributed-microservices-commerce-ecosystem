/**
 * Nominal typing for primitives: a `UserId` and a `SessionId` are both strings at runtime,
 * but the compiler refuses to mix them up.
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };
