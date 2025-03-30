# ATLAS Changelog

## [1.3.0] - YYYY-MM-DD

### Added
- Production-ready password reset system with secure token handling
- Email integration with Resend for transactional emails
- Professional email templates for password reset communications
- Secure password update flow with strong validation
- Database schema for password reset tokens with automatic token expiration
- Docker entrypoint script modifications to ensure password reset functionality is properly initialized
- Comprehensive documentation for password reset system testing and deployment

### Changed
- Enhanced security for authentication flows
- Improved error handling for auth-related API routes
- Updated UI components to use the latest shadcn/ui standards
- Improved form validation with zod schema validation

### Fixed
- Addressed potential security vulnerabilities in authentication flows
- Fixed handling of database URLs with schema parameters

## [Earlier Versions]

Please refer to git history for changes prior to version 1.3.0. 