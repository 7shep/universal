export type Brand = string & { readonly __brand: unique symbol };

export interface Identifiable {
  id: string;
}

export type Result<T, E = Error> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const success = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const failure = <E>(error: E): Result<never, E> => ({ ok: false, error });
