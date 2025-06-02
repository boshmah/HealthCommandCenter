/**
 * Enum representing user groups in the application.
 * Used for role-based access control.
 */
export enum UserGroup {
  /**
   * Regular users with standard permissions
   */
  REGULAR_USERS = 'RegularUsers',
  
  /**
   * Admin users with elevated permissions
   */
  ADMIN_USERS = 'AdminUsers'
}
