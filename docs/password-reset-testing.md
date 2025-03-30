# Password Reset System Testing Guide

This document outlines the testing procedures for verifying that the password reset functionality is working correctly in the ATLAS application.

## Prerequisites

- ATLAS application running locally or in a Docker container
- Access to the database and its logs
- Email testing capabilities (either via Resend or local logs)
- A registered user account in the system

## Test Cases

### 1. Forgot Password Request

#### Test 1.1: Valid Email Request
1. Navigate to `/auth/login`
2. Click "Forgot your password?" link
3. Enter a valid, registered email address
4. Submit the form
5. **Expected Result**: Success message appears: "If your email is registered, you will receive a password reset link shortly."
6. Check database for a new entry in the `PasswordResetToken` table for this user
7. Check email delivery (or logs in development mode) for reset link

#### Test 1.2: Invalid/Non-existent Email
1. Navigate to `/auth/forgot-password`
2. Enter an email that is not registered in the system
3. Submit the form
4. **Expected Result**: Same success message as above (to prevent email enumeration)
5. Verify no token was created in the database

#### Test 1.3: Malformed Email
1. Navigate to `/auth/forgot-password`
2. Enter a malformed email (e.g., "not-an-email")
3. Submit the form
4. **Expected Result**: Validation error displayed: "Please enter a valid email address"

### 2. Password Reset

#### Test 2.1: Valid Token Flow
1. Obtain a valid reset token (from email or database)
2. Navigate to `/auth/reset-password?token=[valid-token]`
3. Enter a new password and confirmation (meeting complexity requirements)
4. Submit the form
5. **Expected Results**: 
   - Success message: "Your password has been reset successfully"
   - Redirect to the login page after a short delay
   - Verify the user's password has been updated in the database
   - Verify the token has been deleted from the `PasswordResetToken` table (consumed)

#### Test 2.2: Expired Token
1. Modify a token in the database to have an `expiresAt` date in the past
2. Navigate to `/auth/reset-password?token=[expired-token]`
3. Enter a new password and confirmation
4. Submit the form
5. **Expected Result**: Error message indicating the token is invalid or expired

#### Test 2.3: Invalid Token
1. Navigate to `/auth/reset-password?token=invalid-token`
2. Enter a new password and confirmation
3. Submit the form
4. **Expected Result**: Error message indicating the token is invalid or expired

#### Test 2.4: Missing Token
1. Navigate to `/auth/reset-password` (without a token parameter)
2. **Expected Result**: Warning message stating that the token is missing, with a link to request a new password reset

#### Test 2.5: Password Complexity Validation
1. Navigate to `/auth/reset-password?token=[valid-token]`
2. Try various invalid passwords:
   - Too short (less than 8 characters)
   - No uppercase letters
   - No lowercase letters
   - No numbers
3. **Expected Result**: Appropriate validation errors for each case

#### Test 2.6: Password Mismatch
1. Navigate to `/auth/reset-password?token=[valid-token]`
2. Enter a valid password but a different confirmation password
3. Submit the form
4. **Expected Result**: Validation error: "Passwords do not match"

### 3. Security Tests

#### Test 3.1: Token Reuse Attempt
1. Complete a successful password reset using a valid token
2. Attempt to use the same token again (navigate to reset page with same token)
3. Enter a new password and confirmation
4. Submit the form
5. **Expected Result**: Error message indicating the token is invalid or expired (since it was consumed)

#### Test 3.2: Brute Force Protection
1. Make multiple rapid password reset requests for the same email
2. **Expected Result**: System should not be vulnerable to flooding (consider implementing rate limiting)

## Email Verification

### Development Environment
In development mode, the system should:
1. Log the reset URL to the console
2. Send test emails to Resend's test email address (`delivered@resend.dev`)

### Production Environment
In production mode, the system should:
1. Send actual emails to the user's email address
2. Not expose reset URLs in logs

## Troubleshooting

If any tests fail, check:
1. Database connectivity and schema correctness
2. Email service configuration
3. Environment variables
4. Server logs for detailed error messages

## Acceptance Criteria

The password reset system is considered working correctly when:
1. All test cases pass successfully
2. The system maintains security best practices (no email enumeration, single-use tokens, etc.)
3. Users can successfully complete the entire password reset flow
4. The email templates render correctly in various email clients 