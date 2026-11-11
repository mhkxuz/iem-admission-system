import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <div class="badge-icon">IEM</div>
          <h2>Portal Sign In</h2>
          <p>Access your applicant portal or administrative dashboard</p>
        </div>

        <div *ngIf="errorMessage" class="alert-box error">
          {{ errorMessage }}
        </div>

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="auth-form">
          <div class="form-group">
            <label for="email">Email Address</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              placeholder="e.g. your.email@domain.com"
              [class.invalid]="isFieldInvalid('email')"
            />
            <span class="err-text" *ngIf="isFieldInvalid('email')">
              Please enter a valid email address.
            </span>
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <div class="password-input-wrap">
              <input
                id="password"
                [type]="showPassword ? 'text' : 'password'"
                formControlName="password"
                placeholder="••••••••"
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
              Password is required.
            </span>
          </div>

          <button type="submit" class="btn-primary" [disabled]="loginForm.invalid || isSubmitting">
            <span *ngIf="!isSubmitting">Sign In</span>
            <span *ngIf="isSubmitting">Authenticating...</span>
          </button>
        </form>

        <div class="auth-footer">
          <p>Don't have an applicant account? <a routerLink="/auth/register">Register for Admission</a></p>
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
      max-width: 440px;
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
      gap: 1.15rem;
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
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  public errorMessage = '';
  public isSubmitting = false;
  public showPassword = false;

  public loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    this.authService.login(this.loginForm.value).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        const returnUrl = this.route.snapshot.queryParams['returnUrl'];
        if (returnUrl) {
          this.router.navigateByUrl(returnUrl);
        } else if (res.data.user.role === 'admin') {
          this.router.navigate(['/admin/dashboard']);
        } else if (res.data.user.role === 'reviewer') {
          this.router.navigate(['/reviewer/dashboard']);
        } else {
          this.router.navigate(['/applicant/dashboard']);
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.message || 'Invalid email or password. Please try again.';
      }
    });
  }
}
