import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <div class="badge-icon">IEM</div>
          <h2>New Applicant Registration</h2>
          <p>Create an account to begin your admission application for 2026&ndash;2027</p>
        </div>

        <div *ngIf="errorMessage" class="alert-box error">
          {{ errorMessage }}
        </div>

        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="auth-form">
          <div class="form-group">
            <label for="fullName">Full Name</label>
            <input
              id="fullName"
              type="text"
              formControlName="fullName"
              placeholder="e.g. Rahul Sharma"
              [class.invalid]="isFieldInvalid('fullName')"
            />
            <span class="err-text" *ngIf="isFieldInvalid('fullName')">
              Full name must be at least 2 characters.
            </span>
          </div>

          <div class="form-group">
            <label for="email">Email Address</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              placeholder="your.email@domain.com"
              [class.invalid]="isFieldInvalid('email')"
            />
            <span class="err-text" *ngIf="isFieldInvalid('email')">
              A valid email address is required.
            </span>
          </div>

          <div class="form-group">
            <label for="phone">Phone Number</label>
            <input
              id="phone"
              type="tel"
              formControlName="phone"
              placeholder="10-digit mobile number"
              [class.invalid]="isFieldInvalid('phone')"
            />
            <span class="err-text" *ngIf="isFieldInvalid('phone')">
              Please enter a 10-digit phone number.
            </span>
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <div class="password-input-wrap">
              <input
                id="password"
                [type]="showPassword ? 'text' : 'password'"
                formControlName="password"
                placeholder="Minimum 6 characters"
                [class.invalid]="isFieldInvalid('password')"
              />
              <button
                type="button"
                class="password-toggle-btn"
                (click)="togglePasswordVisibility()"
                [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'"
                [title]="showPassword ? 'Hide password' : 'Show password'"
              >
                <span *ngIf="!showPassword">&#128065;</span>
                <span *ngIf="showPassword">&#128584;</span>
              </button>
            </div>
            <span class="err-text" *ngIf="isFieldInvalid('password')">
              Password must be at least 6 characters long.
            </span>
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <div class="password-input-wrap">
              <input
                id="confirmPassword"
                [type]="showConfirmPassword ? 'text' : 'password'"
                formControlName="confirmPassword"
                placeholder="Re-enter password"
                [class.invalid]="registerForm.errors?.['mismatch'] && (registerForm.get('confirmPassword')?.touched || registerForm.get('confirmPassword')?.dirty)"
              />
              <button
                type="button"
                class="password-toggle-btn"
                (click)="toggleConfirmPasswordVisibility()"
                [attr.aria-label]="showConfirmPassword ? 'Hide password' : 'Show password'"
                [title]="showConfirmPassword ? 'Hide password' : 'Show password'"
              >
                <span *ngIf="!showConfirmPassword">&#128065;</span>
                <span *ngIf="showConfirmPassword">&#128584;</span>
              </button>
            </div>
            <span class="err-text" *ngIf="registerForm.errors?.['mismatch'] && (registerForm.get('confirmPassword')?.touched || registerForm.get('confirmPassword')?.dirty)">
              Passwords do not match.
            </span>
          </div>

          <button type="submit" class="btn-primary" [disabled]="registerForm.invalid || isSubmitting">
            <span *ngIf="!isSubmitting">Register as Applicant</span>
            <span *ngIf="isSubmitting">Registering...</span>
          </button>
        </form>

        <div class="auth-footer">
          <p>Already have an account? <a routerLink="/auth/login">Sign In here</a></p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: calc(100vh - 120px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
      background: #f4f7fa;
    }
    .auth-card {
      background: #ffffff;
      border: 1px solid #e1e8f0;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(15, 43, 72, 0.08);
      max-width: 480px;
      width: 100%;
      padding: 2.25rem;
    }
    .auth-header {
      text-align: center;
      margin-bottom: 1.75rem;
    }
    .badge-icon {
      display: inline-block;
      background: #0f2b48;
      color: #c98a2c;
      font-weight: 800;
      font-size: 1.1rem;
      padding: 0.35rem 0.8rem;
      border-radius: 4px;
      margin-bottom: 0.75rem;
    }
    .auth-header h2 {
      margin: 0;
      font-size: 1.4rem;
      color: #0f2b48;
      font-weight: 700;
    }
    .auth-header p {
      margin: 0.35rem 0 0;
      font-size: 0.85rem;
      color: #64748b;
    }
    .alert-box {
      padding: 0.75rem 1rem;
      border-radius: 4px;
      font-size: 0.85rem;
      margin-bottom: 1.25rem;
    }
    .alert-box.error {
      background: #fee2e2;
      border: 1px solid #fca5a5;
      color: #991b1b;
    }
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #334155;
    }
    input {
      padding: 0.65rem 0.85rem;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      font-size: 0.9rem;
      color: #1e293b;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input:focus {
      outline: none;
      border-color: #2b6cb0;
      box-shadow: 0 0 0 3px rgba(43, 108, 176, 0.15);
    }
    input.invalid {
      border-color: #ef4444;
      background: #fff5f5;
    }
    .password-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .password-input-wrap input {
      width: 100%;
      padding-right: 2.5rem;
    }
    .password-toggle-btn {
      position: absolute;
      right: 0.5rem;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1.1rem;
      padding: 0.25rem 0.4rem;
      color: #64748b;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.2s;
    }
    .password-toggle-btn:hover {
      color: #0f2b48;
    }
    .err-text {
      font-size: 0.75rem;
      color: #dc2626;
    }
    .btn-primary {
      background: #0f2b48;
      color: #ffffff;
      border: none;
      padding: 0.75rem;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      margin-top: 0.5rem;
      transition: background 0.2s;
    }
    .btn-primary:hover:not(:disabled) {
      background: #1a426e;
    }
    .btn-primary:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }
    .auth-footer {
      margin-top: 1.5rem;
      text-align: center;
      font-size: 0.85rem;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
      padding-top: 1rem;
    }
    .auth-footer a {
      color: #2b6cb0;
      text-decoration: none;
      font-weight: 600;
    }
    .auth-footer a:hover {
      text-decoration: underline;
    }
  `]
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  public errorMessage = '';
  public isSubmitting = false;
  public showPassword = false;
  public showConfirmPassword = false;

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  public registerForm: FormGroup = this.fb.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    },
    {
      validators: (group: FormGroup) => {
        const pass = group.get('password')?.value;
        const confirm = group.get('confirmPassword')?.value;
        return pass === confirm ? null : { mismatch: true };
      }
    }
  );

  isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const { fullName, email, password, phone } = this.registerForm.value;

    this.authService.register({ fullName, email, password, phone }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.router.navigate(['/applicant/dashboard']);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.message || 'Registration failed. Please check your details.';
      }
    });
  }
}
