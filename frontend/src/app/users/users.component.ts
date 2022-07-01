import { HttpErrorResponse, HttpEvent } from '@angular/common/http';
import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Data } from '@angular/router';
import { BehaviorSubject, Subscription, take } from 'rxjs';
import { Paginator } from '../model/paginator.model';
import { Role } from '../model/role.model';
import { User } from '../model/user.model';
import { NotificationService } from '../service/notification.service';
import { UserService } from '../service/user.service';
import { UsersDialog } from './users-dialog/users.dialog';

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css'],
})
export class UsersComponent implements OnInit, OnDestroy, AfterViewInit {
  dataSource!: MatTableDataSource<User[]>;
  displayedColumns: string[] = [
    'photo',
    'publicId',
    'firstName',
    'lastName',
    'username',
    'email',
    'status',
    'actions',
  ];
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  totalElements!: number;

  constructor(
    private userService: UserService,
    // private activatedRoute: ActivatedRoute,
    private notificationService: NotificationService,
    public dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.dataSource = new MatTableDataSource();
    this.refresh();
  }

  refresh(page: number = 0, size: number = 5): void {
    this.userService
      // .getUsers2(page, size)
      .getUsers()
      .pipe(take(1)) // subscribes until 1 value taken - then automatically unsubscribes
      .subscribe({
        next: (response) => {
          this.totalElements = response.totalElements;
          // this.userService.addUsersToLocalStorage(response.content);
          this.dataSource.data = response.content;
          this.notificationService.showNotification('info', `${response.totalElements} ${response.totalElements === 1 ? `user` : `users`}  was successfully loaded.`);
        },
        error: (err: HttpErrorResponse) => {
          this.notificationService.showNotification(
            'error',
            'An error occured. Please try again'
          );
        },
      });
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
  }

  ngOnDestroy(): void {}

  /*public loadPaginatorData(event: PageEvent) {
    console.log(event);
    console.log('this.paginator ', this.paginator);
    this.paginator.pageIndex = event.pageIndex;

    this.refresh(event.pageIndex, event.pageSize);
    return event;
  }*/

  applyFilter(field: KeyboardEvent) {
    const filterText = (field.target as HTMLInputElement).value;
    this.dataSource.filter = filterText.trim().toLowerCase();
  }

  onDelete(user: User) {
    // do stuff
    let confirmAction = confirm('Are you sure you want to delete the user?');
    if (confirmAction) {
      this.userService
        .deleteUser(user.publicId!)
        .pipe(take(1)) // subscribes until 1 value taken - then automatically unsubscribes
        .subscribe({
          next: (response) => {
            this.refresh();
            this.notificationService.showNotification(
              'success',
              `User with email ${user.email} was deleted successfully`
            );
          },
          error: (err: HttpErrorResponse) => {
            this.notificationService.showNotification(
              'error',
              'An error occured. Please try again'
            );
          },
        });
    }
  }

  openEditDialog(user: User): void {
    // hide password
    const userFromDBPass = user.password;
    user.password = '';

    const dialogRef = this.dialog.open(UsersDialog, {
      height: '400px',
      width: '600px',
      data: user,
    });

    dialogRef.afterClosed().subscribe((result) => {
      console.log('The dialog was closed');
      console.log('RESULT:: ', result);
      if (
        result !== null &&
        result !== undefined &&
        !(typeof result === 'string' && result === '')
      ) {
        const updatedUser: User = result;
        updatedUser.publicId = user.publicId;
        updatedUser.profileImageUrl = user.profileImageUrl;
        if (result.password === '') {
          updatedUser.password = userFromDBPass;
        }
        // update user in DB
        this.userService
          .updateUser(updatedUser)
          .pipe(take(1))
          .subscribe({
            next: (response: User) => {
              // update image if provided (refactor to external method)
              if(result.fileSource){

                const formData = new FormData();
                formData.append('email', response.email);
                formData.append('profileImage', result.fileSource);

                this.userService.updateProfileImage(formData)
                .pipe(take(1))
                .subscribe({
                  next: (response: HttpEvent<any>) => {
                    this.notificationService.showNotification(
                      'success',
                      `User ${updatedUser.username} successfully updated.`
                    );
                    this.refresh();
                  },
                  error: (err: HttpErrorResponse) => {
                    console.log(err);
                    this.notificationService.showNotification(
                      'error',
                      'An error occured uploading user profile image. Please try again'
                    );
                  }
                });
              }
            },
            error: (err: HttpErrorResponse) => {
              if (err.error.message === undefined) {
                this.notificationService.showNotification(
                  'error',
                  'An error occured. Please try again'
                );
              } else {
                this.notificationService.showNotification(
                  'error',
                  err.error.message
                );
              }
            },
          });
      }
    });
  }

  openCreateDialog(): void {
    const newDummyUser = new User(
      null,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      true,
      true,
      null
    );

    const dialogRef = this.dialog.open(UsersDialog, {
      height: '400px',
      width: '600px',
      data: newDummyUser,
    });

    dialogRef.afterClosed().subscribe((result) => {
      // console.log('The dialog was closed');
      // console.log('RESULT:: ', result);
      if (
        result !== null &&
        result !== undefined &&
        !(typeof result === 'string' && result === '')
      ) {
        const userToSave: User = result;
        this.userService
          .createUser(userToSave)
          .pipe(take(1))
          .subscribe({
            next: (response: User) => {
              // update image if provided (refactor to external method)
              if(result.fileSource){

                const formData = new FormData();
                formData.append('email', response.email);
                formData.append('profileImage', result.fileSource);

                this.userService.updateProfileImage(formData)
                .pipe(take(1))
                .subscribe({
                  next: (response: HttpEvent<any>) => {
                    this.notificationService.showNotification(
                      'success',
                      `User ${newDummyUser.username} successfully updated.`
                    );
                    this.refresh();
                  },
                  error: (err: HttpErrorResponse) => {
                    console.log(err);
                    this.notificationService.showNotification(
                      'error',
                      'An error occured uploading user profile image. Please try again'
                    );
                  }
                });
              }
            },
            error: (err: HttpErrorResponse) => {
              if (err.error.message === undefined) {
                this.notificationService.showNotification(
                  'error',
                  'An error occured. Please try again'
                );
              } else {
                this.notificationService.showNotification(
                  'error',
                  err.error.message
                );
              }
            },
          });
      }
    });
  }
}
