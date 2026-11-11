import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="portal-header">
      <div class="header-container">
        <div class="branding" routerLink="/">
          <img
            src="assets/iem-logo.png"
            alt="Institute of Engineering & Management Logo"
            class="navbar-logo"
          />
          <div class="brand-text">
            <span class="inst-name">Institute of Engineering & Management</span>
            <span class="portal-sub">Online Admission Portal &bull; Session 2026&ndash;2027</span>
          </div>
        </div>

        <button
          type="button"
          class="mobile-menu-toggle"
          (click)="toggleMobileMenu()"
          [attr.aria-expanded]="isMobileMenuOpen"
          aria-label="Toggle navigation menu"
        >
          <span class="bar"></span>
          <span class="bar"></span>
          <span class="bar"></span>
        </button>

        <nav class="nav-links" [class.open]="isMobileMenuOpen">
          <!-- Public Navigation Links -->
          <a
            routerLink="/"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            (click)="closeMobileMenu()"
            class="nav-item"
          >
            Home
          </a>
          <a
            routerLink="/programmes"
            routerLinkActive="active"
            (click)="closeMobileMenu()"
            class="nav-item"
          >
            Programmes
          </a>
          <a
            routerLink="/admission-process"
            routerLinkActive="active"
            (click)="closeMobileMenu()"
            class="nav-item"
          >
            Admission Process
          </a>
          <a
            routerLink="/fees"
            routerLinkActive="active"
            (click)="closeMobileMenu()"
            class="nav-item"
          >
            Fees
          </a>
          <a
            routerLink="/faqs"
            routerLinkActive="active"
            (click)="closeMobileMenu()"
            class="nav-item"
          >
            FAQs
          </a>
          <a
            routerLink="/announcements"
            routerLinkActive="active"
            (click)="closeMobileMenu()"
            class="nav-item"
          >
            Announcements
          </a>

          <!-- Role-based & Authentication Navigation -->
          <ng-container *ngIf="authService.currentUser$ | async as user; else guestNav">
            <ng-container *ngIf="user.role === 'applicant'">
              <a
                routerLink="/applicant/dashboard"
                routerLinkActive="active"
                (click)="closeMobileMenu()"
                class="nav-item"
              >
                Dashboard
              </a>
              <a
                routerLink="/applicant/apply"
                routerLinkActive="active"
                (click)="closeMobileMenu()"
                class="nav-item"
              >
                Application Form
              </a>
              <a
                routerLink="/applicant/merit-list"
                routerLinkActive="active"
                (click)="closeMobileMenu()"
                class="nav-item"
              >
                Published Merit List
              </a>
            </ng-container>

            <ng-container *ngIf="user.role === 'admin'">
              <a
                routerLink="/admin/dashboard"
                routerLinkActive="active"
                (click)="closeMobileMenu()"
                class="nav-item"
              >
                Admin Dashboard
              </a>
            </ng-container>

            <ng-container *ngIf="user.role === 'reviewer'">
              <a
                routerLink="/reviewer/dashboard"
                routerLinkActive="active"
                (click)="closeMobileMenu()"
                class="nav-item"
              >
                Verification Desk
              </a>
            </ng-container>

            <div class="user-pill">
              <span class="user-name">{{ user.fullName }}</span>
              <span class="role-badge" [ngClass]="user.role">{{ user.role | uppercase }}</span>
            </div>

            <button class="btn-logout" (click)="logout()">Sign Out</button>
          </ng-container>

          <ng-template #guestNav>
            <a
              routerLink="/auth/login"
              routerLinkActive="active"
              (click)="closeMobileMenu()"
              class="nav-item"
            >
              Sign In
            </a>
            <a
              routerLink="/auth/register"
              (click)="closeMobileMenu()"
              class="btn-register"
            >
              Register
            </a>
          </ng-template>
        </nav>
      </div>
    </header>
  `,
  styles: [`
    .portal-header {
      background: #0f2b48;
      color: #ffffff;
      box-shadow: 0 2px 10px rgba(0,0,0,0.12);
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    .header-container {
      max-width: 1240px;
      margin: 0 auto;
      padding: 0.75rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .branding {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      cursor: pointer;
      text-decoration: none;
      color: inherit;
    }
    .navbar-logo {
      height: 48px;
      width: auto;
      max-width: 60px;
      object-fit: contain;
      background: #ffffff;
      border-radius: 4px;
      padding: 2px 4px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.18);
      display: block;
      flex-shrink: 0;
    }
    .brand-text {
      display: flex;
      flex-direction: column;
    }
    .inst-name {
      font-weight: 700;
      font-size: 1.05rem;
      letter-spacing: 0.3px;
    }
    .portal-sub {
      font-size: 0.75rem;
      color: #a4c2e0;
      letter-spacing: 0.2px;
    }
    .mobile-menu-toggle {
      display: none;
      flex-direction: column;
      gap: 5px;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0.5rem;
    }
    .mobile-menu-toggle .bar {
      width: 24px;
      height: 2px;
      background: #ffffff;
      border-radius: 2px;
    }
    .nav-links {
      display: flex;
      align-items: center;
      gap: 0.9rem;
      flex-wrap: wrap;
    }
    .nav-item {
      color: #d1e2f2;
      text-decoration: none;
      font-size: 0.88rem;
      font-weight: 500;
      padding: 0.35rem 0.55rem;
      border-radius: 4px;
      transition: color 0.2s, background 0.2s;
      white-space: nowrap;
    }
    .nav-item:hover, .nav-item.active {
      color: #ffffff;
      background: rgba(255,255,255,0.1);
    }
    .user-pill {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255,255,255,0.08);
      padding: 0.3rem 0.75rem;
      border-radius: 20px;
      font-size: 0.85rem;
      margin-left: 0.25rem;
    }
    .user-name {
      font-weight: 600;
    }
    .role-badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.15rem 0.45rem;
      border-radius: 3px;
      letter-spacing: 0.5px;
    }
    .role-badge.applicant {
      background: #2b6cb0;
      color: #ffffff;
    }
    .role-badge.admin {
      background: #c98a2c;
      color: #0f2b48;
    }
    .role-badge.reviewer {
      background: #10b981;
      color: #ffffff;
    }
    .btn-logout {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.3);
      color: #ffffff;
      padding: 0.35rem 0.85rem;
      border-radius: 4px;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .btn-logout:hover {
      background: rgba(255,255,255,0.15);
      border-color: #ffffff;
    }
    .btn-register {
      background: #c98a2c;
      color: #0f2b48;
      font-weight: 600;
      font-size: 0.85rem;
      padding: 0.45rem 1rem;
      border-radius: 4px;
      text-decoration: none;
      transition: background 0.2s;
      white-space: nowrap;
    }
    .btn-register:hover {
      background: #d99a3c;
    }
    @media (max-width: 1100px) {
      .mobile-menu-toggle {
        display: flex;
      }
      .nav-links {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: #0f2b48;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        padding: 1.25rem 1.5rem;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
        box-shadow: 0 8px 16px rgba(0,0,0,0.25);
      }
      .nav-links.open {
        display: flex;
      }
      .nav-item {
        width: 100%;
        padding: 0.5rem 0.75rem;
      }
      .user-pill {
        margin-left: 0;
        margin: 0.5rem 0;
      }
    }
    @media (max-width: 768px) {
      .header-container {
        padding: 0.6rem 1rem;
      }
      .navbar-logo {
        height: 40px;
        max-width: 50px;
        padding: 2px 3px;
      }
      .inst-name {
        font-size: 0.95rem;
      }
      .portal-sub {
        font-size: 0.7rem;
      }
    }
    @media (max-width: 480px) {
      .navbar-logo {
        height: 36px;
        max-width: 44px;
      }
      .portal-sub {
        display: none;
      }
    }
  `]
})
export class NavbarComponent {
  public authService = inject(AuthService);
  isMobileMenuOpen = false;

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  logout(): void {
    this.closeMobileMenu();
    this.authService.logout();
  }
}
