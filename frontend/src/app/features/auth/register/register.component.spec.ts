import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { RegisterComponent } from './register.component';
import { AuthService } from '../../../core/services/auth.service';

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let component: RegisterComponent;
  let authServiceMock: { register: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    authServiceMock = { register: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function fillValidForm(): void {
    component.registerForm.setValue({
      fullName: 'Stage Eight Applicant',
      email: 'stage8@example.com',
      phone: '9830000001',
      password: 'Password@123',
      confirmPassword: 'Password@123'
    });
  }

  it('should register a valid applicant and navigate to the applicant dashboard', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    authServiceMock.register.mockReturnValue(
      of({
        success: true,
        message: 'Registration successful.',
        data: {
          token: 'token',
          user: {
            _id: 'applicant-1',
            fullName: 'Stage Eight Applicant',
            email: 'stage8@example.com',
            role: 'applicant'
          }
        }
      })
    );

    fillValidForm();
    component.onSubmit();

    expect(authServiceMock.register).toHaveBeenCalledWith({
      fullName: 'Stage Eight Applicant',
      email: 'stage8@example.com',
      password: 'Password@123',
      phone: '9830000001'
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/applicant/dashboard']);
    expect(component.isSubmitting).toBe(false);
  });

  it('should show the backend duplicate-email message', () => {
    authServiceMock.register.mockReturnValue(
      throwError(() => ({ error: { message: 'An account with this email already exists.' } }))
    );

    fillValidForm();
    component.onSubmit();
    fixture.detectChanges();

    expect(component.errorMessage).toBe('An account with this email already exists.');
    expect(fixture.nativeElement.querySelector('.alert-box.error')?.textContent).toContain(
      'already exists'
    );
  });

  it('should block submission when passwords do not match', () => {
    fillValidForm();
    component.registerForm.patchValue({ confirmPassword: 'DifferentPassword' });
    component.onSubmit();
    fixture.detectChanges();

    expect(authServiceMock.register).not.toHaveBeenCalled();
    expect(component.registerForm.hasError('mismatch')).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Passwords do not match.');
  });

  it('should mark fields as touched and block submission when the form is invalid', () => {
    component.onSubmit();

    expect(authServiceMock.register).not.toHaveBeenCalled();
    expect(component.registerForm.get('fullName')?.touched).toBe(true);
    expect(component.registerForm.get('email')?.touched).toBe(true);
  });
});
