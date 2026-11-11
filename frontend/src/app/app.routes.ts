import { Routes } from '@angular/router';
import { authGuard, applicantGuard, adminGuard, reviewerGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Public Portal Routes
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/public/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'programmes',
    loadComponent: () =>
      import('./features/public/programmes/programmes.component').then(m => m.ProgrammesComponent)
  },
  {
    path: 'programmes/:id',
    loadComponent: () =>
      import('./features/public/programme-detail/programme-detail.component').then(
        m => m.ProgrammeDetailComponent
      )
    },
  {
    path: 'admission-process',
    loadComponent: () =>
      import('./features/public/admission-process/admission-process.component').then(
        m => m.AdmissionProcessComponent
      )
  },
  {
    path: 'process',
    redirectTo: 'admission-process'
  },
  {
    path: 'fees',
    loadComponent: () =>
      import('./features/public/fees/fees.component').then(m => m.FeesComponent)
  },
  {
    path: 'faqs',
    loadComponent: () =>
      import('./features/public/faqs/faqs.component').then(m => m.FaqsComponent)
  },
  {
    path: 'announcements',
    loadComponent: () =>
      import('./features/public/announcements/announcements.component').then(
        m => m.AnnouncementsComponent
      )
  },

  // Authentication Routes
  {
    path: 'auth/login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'auth/register',
    loadComponent: () =>
      import('./features/auth/register/register.component').then(m => m.RegisterComponent)
  },

  // Authenticated Applicant Routes
  {
    path: 'applicant/dashboard',
    canActivate: [authGuard, applicantGuard],
    loadComponent: () =>
      import('./features/applicant/dashboard/applicant-dashboard.component').then(
        m => m.ApplicantDashboardComponent
      )
  },
  {
    path: 'applicant/apply',
    canActivate: [authGuard, applicantGuard],
    loadComponent: () =>
      import('./features/applicant/application-form/application-form.component').then(
        m => m.ApplicationFormComponent
      )
  },
  {
    path: 'applicant/merit-list',
    canActivate: [authGuard, applicantGuard],
    loadComponent: () =>
      import('./features/applicant/merit-list/applicant-merit-list.component').then(
        m => m.ApplicantMeritListComponent
      )
  },

  // Authenticated Administrative Routes
  {
    path: 'admin/dashboard',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/admin/dashboard/admin-dashboard.component').then(
        m => m.AdminDashboardComponent
      )
  },
  {
    path: 'admin/programmes',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/admin/programmes/admin-programmes.component').then(
        m => m.AdminProgrammesComponent
      )
  },
  {
    path: 'admin/sessions',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/admin/sessions/admin-sessions.component').then(
        m => m.AdminSessionsComponent
      )
  },
  {
    path: 'admin/fees',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/admin/fees/admin-fees.component').then(
        m => m.AdminFeesComponent
      )
  },
  {
    path: 'admin/overview',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/admin/overview/admin-overview.component').then(
        m => m.AdminOverviewComponent
      )
  },
  {
    path: 'admin/reviewers',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/admin/reviewers/admin-reviewers.component').then(
        m => m.AdminReviewersComponent
      )
  },
  {
    path: 'admin/merit',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/admin/merit/admin-merit.component').then(
        m => m.AdminMeritComponent
      )
  },
  {
    path: 'admin/enrolments',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/admin/enrolment/admin-enrolment.component').then(
        m => m.AdminEnrolmentComponent
      )
  },
  {
    path: 'admin/reports',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/admin/reports/admin-reports.component').then(
        m => m.AdminReportsComponent
      )
  },

  // Authenticated Reviewer Routes
  {
    path: 'reviewer/dashboard',
    canActivate: [authGuard, reviewerGuard],
    loadComponent: () =>
      import('./features/reviewer/dashboard/reviewer-dashboard.component').then(
        m => m.ReviewerDashboardComponent
      )
  },
  {
    path: 'reviewer',
    redirectTo: 'reviewer/dashboard'
  },

  // Catch-all Redirect to Public Home
  {
    path: '**',
    redirectTo: ''
  }
];
