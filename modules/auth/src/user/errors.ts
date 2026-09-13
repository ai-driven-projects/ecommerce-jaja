export const UserErrors = {
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
} as const

export type UserErrorCode = (typeof UserErrors)[keyof typeof UserErrors]
