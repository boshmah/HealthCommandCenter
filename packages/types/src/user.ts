/**
 * User and authentication-related types for the Health Command Center
 */

/**
 * User groups for role-based access control
 */
export enum UserGroup {
  REGULAR_USERS = 'RegularUsers',
  ADMIN_USERS = 'AdminUsers',
}

/**
 * User entity stored in DynamoDB
 * PK: USER#<userId>
 * SK: PROFILE
 */
export interface UserEntity {
  PK: string;
  SK: string;
  entityType: 'USER';
  userId: string;
  email: string;
  groups: UserGroup[];
  createdAt: string;
  updatedAt: string;
}
