# Microsoft Entra authentication setup

The application keeps the existing password and mobile OTP methods. Entra buttons remain disabled until the following public configuration values are deployed.

## Customer email OTP (External ID)

1. Create a Microsoft Entra External ID external tenant.
2. Create a sign-up/sign-in user flow using **Email one-time passcode**.
3. Register a single-page application and associate it with that user flow.
4. Add SPA redirect URIs:
   - `https://ramsboutique.com`
   - `https://www.ramsboutique.com`
   - `http://localhost:3000`
5. Set the frontend `REACT_APP_ENTRA_EXTERNAL_CLIENT_ID` and `REACT_APP_ENTRA_EXTERNAL_AUTHORITY` values.
6. Set the backend `ENTRA_EXTERNAL_TENANT_ID` and `ENTRA_EXTERNAL_CLIENT_ID` values.

New email-OTP customers are created with an empty phone and routed to Profile to add a valid ten-digit number. If their email already exists, they must sign in using their existing method and use **Profile → Link Email OTP Login**. This prevents unsafe automatic account merging.

## Staff Microsoft login (workforce tenant)

1. Register a single-tenant SPA in the workforce tenant.
2. Add the same three SPA redirect URIs listed above.
3. In the application manifest, define app roles with exact values `Admin` and `Agent` and allowed member type `User`.
4. In Enterprise applications, enable **Assignment required** and assign each staff member to the appropriate role.
5. Set the frontend `REACT_APP_ENTRA_WORKFORCE_CLIENT_ID` and `REACT_APP_ENTRA_WORKFORCE_AUTHORITY` values.
6. Set the backend `ENTRA_WORKFORCE_TENANT_ID` and `ENTRA_WORKFORCE_CLIENT_ID` values.

FastAPI verifies Microsoft signatures, issuer, audience, expiry and required claims before issuing the existing short application session. A tenant member without an `Admin` or `Agent` app-role claim receives HTTP 403.

## Deployment notes

- React variables are build-time values and must be configured before rebuilding Azure Static Web Apps.
- FastAPI variables are App Service application settings; restart the App Service after adding them.
- No client secret belongs in React or in this repository.
- Keep the current admin/password and phone OTP paths enabled until production Entra testing passes.
