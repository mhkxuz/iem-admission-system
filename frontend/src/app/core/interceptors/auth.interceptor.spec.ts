import { TestBed } from '@angular/core/testing';
import { HttpRequest, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

describe('Auth HTTP interceptor', () => {
  const authServiceMock = { token: null as string | null };

  beforeEach(() => {
    authServiceMock.token = null;

    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authServiceMock }]
    });
  });

  it('should attach the bearer token to outgoing requests', () => {
    authServiceMock.token = 'test-token';
    const request = new HttpRequest('GET', '/api/admin/dashboard');
    const next = vi.fn((req: HttpRequest<unknown>) =>
      of(new HttpResponse({ status: 200, url: req.url }))
    );

    TestBed.runInInjectionContext(() => authInterceptor(request, next));

    expect(next).toHaveBeenCalledTimes(1);
    const forwarded = next.mock.calls[0]![0];
    expect(forwarded.headers.get('Authorization')).toBe('Bearer test-token');
    expect(forwarded.url).toBe('/api/admin/dashboard');
  });

  it('should leave requests unchanged when no token is stored', () => {
    const request = new HttpRequest('GET', '/api/health');
    const next = vi.fn((req: HttpRequest<unknown>) =>
      of(new HttpResponse({ status: 200, url: req.url }))
    );

    TestBed.runInInjectionContext(() => authInterceptor(request, next));

    const forwarded = next.mock.calls[0]![0];
    expect(forwarded).toBe(request);
    expect(forwarded.headers.has('Authorization')).toBe(false);
  });
});
