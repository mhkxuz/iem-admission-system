import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { NavbarComponent } from './navbar.component';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.model';

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;
  let currentUser$: BehaviorSubject<User | null>;
  let authServiceMock: {
    currentUser$: BehaviorSubject<User | null>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    currentUser$ = new BehaviorSubject<User | null>(null);
    authServiceMock = {
      currentUser$,
      logout: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    fixture.detectChanges();
  });

  it('should render sign-in and register links for guests', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Sign In');
    expect(text).toContain('Register');
    expect(fixture.nativeElement.querySelector('.btn-logout')).toBeNull();
  });

  it('should render applicant navigation and the signed-in user', () => {
    currentUser$.next({
      _id: 'applicant-1',
      fullName: 'Stage Eight Applicant',
      email: 'stage8@example.com',
      role: 'applicant'
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Stage Eight Applicant');
    expect(text).toContain('APPLICANT');
    expect(text).toContain('Application Form');
    expect(text).toContain('Sign Out');
    expect(fixture.nativeElement.querySelector('.btn-register')).toBeNull();
  });

  it('should render administrator navigation and sign out through the auth service', () => {
    currentUser$.next({
      _id: 'admin-1',
      fullName: 'Administrator',
      email: 'admin@iem.edu',
      role: 'admin'
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Admin Dashboard');
    expect(fixture.nativeElement.textContent).toContain('ADMIN');

    fixture.nativeElement.querySelector('.btn-logout').click();
    expect(authServiceMock.logout).toHaveBeenCalledTimes(1);
  });

  it('should render the official IEM college logo and branding text', () => {
    const logoImg: HTMLImageElement | null = fixture.nativeElement.querySelector('img.navbar-logo');
    expect(logoImg).toBeTruthy();
    expect(logoImg?.getAttribute('src')).toBe('assets/iem-logo.png');
    expect(logoImg?.getAttribute('alt')).toContain('Institute of Engineering & Management');

    const brandText = fixture.nativeElement.querySelector('.brand-text')?.textContent;
    expect(brandText).toContain('Institute of Engineering & Management');
    expect(brandText).toContain('Session 2026–2027');
  });
});
