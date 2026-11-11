import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let authServiceMock: { login: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authServiceMock = { login: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should submit valid credentials and route applicants to their dashboard', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    authServiceMock.login.mockReturnValue(
      of({
        success: true,
        message: 'Login successful.',
        data: {
          token: 'applicant-token',
          user: {
            _id: 'applicant-1',
            fullName: 'Applicant',
            email: 'applicant@example.com',
            role: 'applicant'
          }
        }
      })
    );

    component.loginForm.setValue({
      email: 'applicant@example.com',
      password: 'Password@123'
    });
    component.onSubmit();

    expect(authServiceMock.login).toHaveBeenCalledWith({
      email: 'applicant@example.com',
      password: 'Password@123'
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/applicant/dashboard']);
    expect(component.isSubmitting).toBe(false);
  });

  it('should display the backend error message and stop submitting on failure', () => {
    authServiceMock.login.mockReturnValue(
      throwError(() => ({ error: { message: 'Invalid email or password' } }))
    );

    component.loginForm.setValue({
      email: 'wrong@example.com',
      password: 'WrongPassword'
    });
    component.onSubmit();
    fixture.detectChanges();

    expect(component.errorMessage).toBe('Invalid email or password');
    expect(component.isSubmitting).toBe(false);
    expect(fixture.nativeElement.querySelector('.alert-box.error')?.textContent).toContain(
      'Invalid email or password'
    );
  });

  it('should not submit an invalid form', () => {
    component.loginForm.setValue({ email: 'not-an-email', password: '' });
    component.onSubmit();

    expect(authServiceMock.login).not.toHaveBeenCalled();
    expect(component.loginForm.get('email')?.touched).toBe(true);
  });
});
