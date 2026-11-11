import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AdminReviewersComponent } from './admin-reviewers.component';
import { AdminService } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/user.model';
import { ActivatedRoute } from '@angular/router';

describe('AdminReviewersComponent', () => {
  let component: AdminReviewersComponent;
  let fixture: ComponentFixture<AdminReviewersComponent>;
  let mockAdminService: any;
  let mockAuthService: any;

  const mockUsers: User[] = [
    {
      _id: 'user-1',
      fullName: 'Rahul Roy',
      email: 'rahul@iem.edu',
      role: 'applicant',
      phone: '9830112233'
    },
    {
      _id: 'user-2',
      fullName: 'Dr. Reviewer',
      email: 'reviewer@iem.edu',
      role: 'reviewer',
      phone: '9830112244'
    }
  ];

  beforeEach(async () => {
    mockAdminService = {
      getUsers: vi.fn(() =>
        of({
          success: true,
          message: 'Users retrieved',
          data: mockUsers,
          meta: { total: 2 }
        })
      ),
      updateUserRole: vi.fn(() =>
        of({
          success: true,
          message: 'Role updated',
          data: { ...mockUsers[0], role: 'reviewer' }
        })
      ),
      createReviewer: vi.fn(() =>
        of({
          success: true,
          message: 'Reviewer created',
          data: { _id: 'user-3', fullName: 'Prof. Roy', email: 'roy@iem.edu', role: 'reviewer' }
        })
      )
    };

    mockAuthService = {
      currentUserValue: {
        _id: 'admin-1',
        fullName: 'Admin User',
        email: 'admin@iem.edu',
        role: 'admin'
      }
    };

    await TestBed.configureTestingModule({
      imports: [AdminReviewersComponent],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ActivatedRoute, useValue: { snapshot: {} } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminReviewersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates component and loads users on init', () => {
    expect(component).toBeTruthy();
    expect(mockAdminService.getUsers).toHaveBeenCalled();
    expect(component.users.length).toBe(2);
    expect(component.reviewerCount).toBe(1);
    expect(component.applicantCount).toBe(1);
  });

  it('updates an applicant to reviewer role', () => {
    component.changeRole(mockUsers[0], 'reviewer');
    expect(mockAdminService.updateUserRole).toHaveBeenCalledWith('user-1', 'reviewer');
    expect(component.successMessage).toMatch(/updated to 'reviewer'/i);
  });

  it('creates a new reviewer successfully', () => {
    component.openCreateModal();
    expect(component.showCreateModal).toBe(true);

    component.newReviewer = {
      fullName: 'Prof. Roy',
      email: 'roy@iem.edu',
      password: 'Password@123',
      phone: '9830112277'
    };

    component.submitCreateReviewer();
    expect(mockAdminService.createReviewer).toHaveBeenCalledWith(component.newReviewer);
    expect(component.showCreateModal).toBe(false);
  });

  it('handles user load error and allows retry', () => {
    mockAdminService.getUsers = vi.fn(() =>
      throwError(() => ({ error: { message: 'Database connection failed' } }))
    );

    component.loadUsers();
    expect(component.loadError).toBe('Database connection failed');
  });
});
