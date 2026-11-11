import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should register, store the session and expose the authenticated user', () => {
    service
      .register({
        fullName: 'Stage Eight Applicant',
        email: 'stage8@example.com',
        password: 'Password@123',
        phone: '9830000001'
      })
      .subscribe();

    const req = httpMock.expectOne('http://localhost:5000/api/auth/register');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.email).toBe('stage8@example.com');

    req.flush({
      success: true,
      message: 'Registration successful.',
      data: {
        token: 'register-token',
        user: {
          _id: 'user-1',
          fullName: 'Stage Eight Applicant',
          email: 'stage8@example.com',
          role: 'applicant'
        }
      }
    });

    expect(service.token).toBe('register-token');
    expect(service.isAuthenticated()).toBe(true);
    expect(service.isApplicant()).toBe(true);
    expect(service.isAdmin()).toBe(false);
    expect(service.currentUserValue?.email).toBe('stage8@example.com');
    expect(localStorage.getItem('iem_auth_token')).toBe('register-token');
  });

  it('should log in, store the admin role and fetch the latest profile', () => {
    service.login({ email: 'admin@iem.edu', password: 'AdminPassword@123' }).subscribe();

    const loginReq = httpMock.expectOne('http://localhost:5000/api/auth/login');
    expect(loginReq.request.method).toBe('POST');
    loginReq.flush({
      success: true,
      message: 'Login successful.',
      data: {
        token: 'admin-token',
        user: {
          _id: 'admin-1',
          fullName: 'Administrator',
          email: 'admin@iem.edu',
          role: 'admin'
        }
      }
    });

    expect(service.isAdmin()).toBe(true);
    expect(service.isApplicant()).toBe(false);

    service.getProfile().subscribe();
    const profileReq = httpMock.expectOne('http://localhost:5000/api/auth/me');
    expect(profileReq.request.headers.get('Authorization')).toBeNull();
    profileReq.flush({
      success: true,
      message: 'Profile retrieved.',
      data: {
        _id: 'admin-1',
        fullName: 'Updated Administrator',
        email: 'admin@iem.edu',
        role: 'admin'
      }
    });

    expect(service.currentUserValue?.fullName).toBe('Updated Administrator');
  });

  it('should clear the session and navigate to login on logout', () => {
    localStorage.setItem('iem_auth_token', 'token');
    localStorage.setItem(
      'iem_auth_user',
      JSON.stringify({ _id: '1', fullName: 'User', email: 'u@example.com', role: 'applicant' })
    );
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    service.logout();

    expect(service.token).toBeNull();
    expect(service.currentUserValue).toBeNull();
    expect(localStorage.getItem('iem_auth_token')).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(['/auth/login']);
  });
});
