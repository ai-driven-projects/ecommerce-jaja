export const PasswordErrors = {
  NOT_HASHED: 'PASSWORD_NOT_HASHED',
} as const

export type PasswordErrorCode =
  (typeof PasswordErrors)[keyof typeof PasswordErrors]
