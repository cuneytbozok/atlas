# Deployment Checklist for Password Reset System

## Before Deployment

- [ ] Verify email service provider account (Resend) is active and properly configured
- [ ] Ensure all environment variables are properly set in production environment:
  - [ ] `RESEND_API_KEY` is set with a valid API key
  - [ ] `EMAIL_FROM` is configured with a valid sender email (verify domain ownership if not using Resend's default domain)
  - [ ] `EMAIL_REPLY_TO` is configured with the email address that users should reply to
  - [ ] `NEXTAUTH_URL` is set to the correct production URL
- [ ] Test the password reset flow in a staging environment
- [ ] Run the database setup script (`setup-password-reset.sh`) on the production database
- [ ] Backup the production database before deployment

## Deployment Steps

1. Deploy application code to production environment
2. Verify Docker entrypoint scripts are correctly configured
3. Ensure necessary ports are accessible (typically port 3000 for Next.js)
4. Run database migrations
5. Execute `setup-password-reset.sh` if not automatically run by entrypoint scripts
6. Verify the `PasswordResetToken` table exists in the database

## Post-Deployment Verification

- [ ] Test the password reset flow end-to-end in production:
  - [ ] Request a password reset link
  - [ ] Verify email is received with correct formatting
  - [ ] Verify reset link works properly
  - [ ] Verify password can be reset successfully
- [ ] Check production logs to ensure no sensitive information is exposed
- [ ] Monitor Resend dashboard for email delivery metrics
- [ ] Verify error handling and security measures:
  - [ ] Email enumeration prevention
  - [ ] Token expiration
  - [ ] Token consumption after use

## Rollback Plan

If issues are detected with the password reset system:

1. Identify the source of the issue
2. Fix the issue with a targeted solution if possible
3. If not immediately resolvable, consider temporarily disabling the password reset functionality
4. For critical issues, restore the database from backup if necessary
5. Update documentation with any lessons learned

## Future Enhancements

- [ ] Consider implementing rate limiting for password reset requests
- [ ] Enhance monitoring for failed password reset attempts
- [ ] Create automated tests for the password reset flow
- [ ] Consider additional security measures like notifying users when their password is reset 