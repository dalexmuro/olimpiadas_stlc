import { describe, expect, it } from "vitest";
import {
  COUNTRIES_LIST,
  evaluatePasswordStrength,
  validateForgotPasswordForm,
  validateLoginForm,
  validateRegisterForm,
  validateResetPasswordForm,
} from "../auth-forms";

describe("Step 1.11 — Authentication Screens & Form Validation", () => {
  it("validates login form credentials properly", () => {
    const invalid = validateLoginForm({ email: "bad-email", password: "" });
    expect(invalid.valid).toBe(false);
    expect(invalid.fieldErrors.email).toBeDefined();
    expect(invalid.fieldErrors.password).toBeDefined();

    const valid = validateLoginForm({
      email: "  autor@sitelocuento.com ",
      password: "Password123",
    });
    expect(valid.valid).toBe(true);
    expect(valid.fieldErrors).toEqual({});
  });

  it("enforces all mandatory fields on registration (firstName, lastName, country, phone, email, password)", () => {
    const empty = validateRegisterForm({
      firstName: "",
      lastName: "",
      country: "",
      phone: "123",
      email: "invalid",
      password: "short",
      confirmPassword: "mismatch",
    });

    expect(empty.valid).toBe(false);
    expect(empty.fieldErrors.firstName).toBeDefined();
    expect(empty.fieldErrors.lastName).toBeDefined();
    expect(empty.fieldErrors.country).toBeDefined();
    expect(empty.fieldErrors.phone).toBeDefined();
    expect(empty.fieldErrors.email).toBeDefined();
    expect(empty.fieldErrors.password).toBeDefined();
    expect(empty.fieldErrors.confirmPassword).toBeDefined();

    const valid = validateRegisterForm({
      firstName: "Gabriela",
      lastName: "Mistral",
      country: "Chile",
      phone: "+56 9 1234 5678",
      email: "gabriela@sitelocuento.com",
      password: "MiClaveSegura2026",
      confirmPassword: "MiClaveSegura2026",
    });

    expect(valid.valid).toBe(true);
    expect(valid.fieldErrors).toEqual({});
    expect(COUNTRIES_LIST).toContain("Venezuela");
  });

  it("validates forgot-password and reset-password forms", () => {
    expect(validateForgotPasswordForm("").valid).toBe(false);
    expect(validateForgotPasswordForm("lector@sitelocuento.com").valid).toBe(
      true
    );

    const badReset = validateResetPasswordForm({
      token: "",
      password: "123",
      confirmPassword: "456",
    });
    expect(badReset.valid).toBe(false);
    expect(badReset.fieldErrors.token).toBeDefined();
    expect(badReset.fieldErrors.password).toBeDefined();
    expect(badReset.fieldErrors.confirmPassword).toBeDefined();

    const validReset = validateResetPasswordForm({
      token: "valid-reset-token",
      password: "NuevaClaveSegura123",
      confirmPassword: "NuevaClaveSegura123",
    });
    expect(validReset.valid).toBe(true);
  });

  it("enforces strong password rules (8+ chars, uppercase, lowercase, number)", () => {
    expect(evaluatePasswordStrength("password1").isStrong).toBe(false);
    expect(evaluatePasswordStrength("PASSWORD1").isStrong).toBe(false);
    expect(evaluatePasswordStrength("PasswordOnly").isStrong).toBe(false);
    expect(evaluatePasswordStrength("Pass1").isStrong).toBe(false);
    expect(evaluatePasswordStrength("Segura2026").isStrong).toBe(true);
  });
});
