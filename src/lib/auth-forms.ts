/**
 * Authentication Forms Validation & Helpers
 * Step 1.11: Validation for /login, /registro, /recuperar-clave, and /verificar-correo
 */

import { MIN_PASSWORD_LENGTH } from "./auth";

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_REGEX = /^[+\d][\d\s\-()]{6,20}$/;

export const COUNTRIES_LIST = [
  "Argentina",
  "Bolivia",
  "Chile",
  "Colombia",
  "Costa Rica",
  "Cuba",
  "Ecuador",
  "El Salvador",
  "España",
  "Estados Unidos",
  "Francia",
  "Guatemala",
  "Honduras",
  "México",
  "Nicaragua",
  "Panamá",
  "Paraguay",
  "Perú",
  "Puerto Rico",
  "República Dominicana",
  "Uruguay",
  "Venezuela",
  "Otro",
] as const;

export interface FormValidationResult {
  valid: boolean;
  fieldErrors: Record<string, string>;
}

export interface PasswordStrengthCheck {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  categoriesMet: number;
  isStrong: boolean;
  errorMessage?: string;
}

/**
 * Evaluates password strength rules:
 * at least 8 characters AND at least 3 of:
 * uppercase letter, lowercase letter, number, special character.
 */
export function evaluatePasswordStrength(
  password: string
): PasswordStrengthCheck {
  const minLength = password.length >= MIN_PASSWORD_LENGTH;
  const hasUppercase = /[A-ZÁÉÍÓÚÑ]/.test(password);
  const hasLowercase = /[a-záéíóúñ]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s]/.test(password);
  const categoriesMet = [
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial,
  ].filter(Boolean).length;
  const isStrong = minLength && categoriesMet >= 3;

  let errorMessage: string | undefined;
  if (!minLength) {
    errorMessage = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  } else if (categoriesMet < 3) {
    errorMessage =
      "La contraseña debe incluir al menos 3 de estos elementos: una mayúscula, una minúscula, un número o un carácter especial.";
  }

  return {
    minLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial,
    categoriesMet,
    isStrong,
    errorMessage,
  };
}

export interface LoginFormInput {
  email: string;
  password: string;
}

/**
 * Validates the login form fields (`email` and `password`).
 */
export function validateLoginForm(input: LoginFormInput): FormValidationResult {
  const fieldErrors: Record<string, string> = {};
  const trimmedEmail = input.email.trim();

  if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
    fieldErrors.email = "Ingresa un correo electrónico válido.";
  }

  if (!input.password || input.password.length === 0) {
    fieldErrors.password = "Ingresa tu contraseña.";
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}

export interface RegisterFormInput {
  firstName: string;
  lastName: string;
  country: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/**
 * Validates the registration form fields, enforcing all mandatory personal fields
 * (`firstName`, `lastName`, `country`, `phone`, `email`) and password rules.
 */
export function validateRegisterForm(
  input: RegisterFormInput
): FormValidationResult {
  const fieldErrors: Record<string, string> = {};

  if (!input.firstName.trim()) {
    fieldErrors.firstName = "El nombre es obligatorio.";
  }
  if (!input.lastName.trim()) {
    fieldErrors.lastName = "El apellido es obligatorio.";
  }
  if (!input.country.trim()) {
    fieldErrors.country = "Selecciona tu país de residencia.";
  }

  const trimmedPhone = input.phone.trim();
  if (!trimmedPhone || !PHONE_REGEX.test(trimmedPhone)) {
    fieldErrors.phone =
      "Ingresa un número de teléfono válido (ej. +58 412 1234567).";
  }

  const trimmedEmail = input.email.trim();
  if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
    fieldErrors.email = "Ingresa un correo electrónico válido.";
  }

  const passwordCheck = evaluatePasswordStrength(input.password);
  if (!passwordCheck.isStrong) {
    fieldErrors.password =
      passwordCheck.errorMessage ??
      `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres, una mayúscula, una minúscula y un número.`;
  }

  if (input.password !== input.confirmPassword) {
    fieldErrors.confirmPassword = "Las contraseñas no coinciden.";
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}

/**
 * Validates the forgot-password email request form.
 */
export function validateForgotPasswordForm(email: string): FormValidationResult {
  const fieldErrors: Record<string, string> = {};
  const trimmed = email.trim();

  if (!trimmed || !EMAIL_REGEX.test(trimmed)) {
    fieldErrors.email = "Ingresa el correo electrónico asociado a tu cuenta.";
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}

/**
 * Validates the password reset form when a user sets a new password with a token.
 */
export function validateResetPasswordForm(input: {
  token: string;
  password: string;
  confirmPassword: string;
}): FormValidationResult {
  const fieldErrors: Record<string, string> = {};

  if (!input.token.trim()) {
    fieldErrors.token =
      "El enlace de recuperación no es válido o ha expirado.";
  }

  const passwordCheck = evaluatePasswordStrength(input.password);
  if (!passwordCheck.isStrong) {
    fieldErrors.password =
      passwordCheck.errorMessage ??
      `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres, una mayúscula, una minúscula y un número.`;
  }

  if (input.password !== input.confirmPassword) {
    fieldErrors.confirmPassword = "Las contraseñas no coinciden.";
  }

  return {
    valid: Object.keys(fieldErrors).length === 0,
    fieldErrors,
  };
}
