import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { authGuard, adminGuard, applicantGuard, reviewerGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('Route guards', () => {
  const routerMock = {
    createUrlTree: vi.fn((commands: unknown[], extras?: unknown) => ({
      commands,
      extras
    }))
  };

  const authServiceMock = {
    isAuthenticated: vi.fn(() => false),
    isAdmin: vi.fn(() => false),
    isApplicant: vi.fn(() => false),
    isReviewer: vi.fn(() => false)
  };

  beforeEach(() => {
    routerMock.createUrlTree.mockClear();
    authServiceMock.isAuthenticated.mockReturnValue(false);
    authServiceMock.isAdmin.mockReturnValue(false);
    authServiceMock.isApplicant.mockReturnValue(false);
    authServiceMock.isReviewer.mockReturnValue(false);

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerMock },
        { provide: AuthService, useValue: authServiceMock }
      ]
    });
  });

  it('should allow authenticated users through authGuard', () => {
    authServiceMock.isAuthenticated.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/admin/dashboard' } as never)
    );

    expect(result).toBe(true);
    expect(routerMock.createUrlTree).not.toHaveBeenCalled();
  });

  it('should redirect unauthenticated users to login with a return URL', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/admin/dashboard' } as never)
    );

    expect(result).toEqual({
      commands: ['/auth/login'],
      extras: { queryParams: { returnUrl: '/admin/dashboard' } }
    });
  });

  it('should allow only admins through adminGuard', () => {
    authServiceMock.isAuthenticated.mockReturnValue(true);
    authServiceMock.isAdmin.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('should redirect applicants away from admin routes', () => {
    authServiceMock.isAuthenticated.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
    expect(result).toEqual({ commands: ['/applicant/dashboard'], extras: undefined });
  });

  it('should allow only applicants through applicantGuard', () => {
    authServiceMock.isAuthenticated.mockReturnValue(true);
    authServiceMock.isApplicant.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() =>
      applicantGuard({} as never, {} as never)
    );
    expect(result).toBe(true);
  });

  it('should redirect admins away from applicant routes', () => {
    authServiceMock.isAuthenticated.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() =>
      applicantGuard({} as never, {} as never)
    );
    expect(result).toEqual({ commands: ['/admin/dashboard'], extras: undefined });
  });

  it('should allow reviewers and admins through reviewerGuard', () => {
    authServiceMock.isAuthenticated.mockReturnValue(true);
    authServiceMock.isReviewer.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() =>
      reviewerGuard({} as never, {} as never)
    );
    expect(result).toBe(true);

    authServiceMock.isReviewer.mockReturnValue(false);
    authServiceMock.isAdmin.mockReturnValue(true);

    const adminResult = TestBed.runInInjectionContext(() =>
      reviewerGuard({} as never, {} as never)
    );
    expect(adminResult).toBe(true);
  });

  it('should redirect applicants away from reviewer routes', () => {
    authServiceMock.isAuthenticated.mockReturnValue(true);
    authServiceMock.isApplicant.mockReturnValue(true);

    const result = TestBed.runInInjectionContext(() =>
      reviewerGuard({} as never, {} as never)
    );
    expect(result).toEqual({ commands: ['/applicant/dashboard'], extras: undefined });
  });
});
