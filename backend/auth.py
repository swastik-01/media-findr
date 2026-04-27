"""
AWS Cognito JWT Token verification middleware.
Verifies tokens issued by Cognito User Pool for authenticated API calls.
"""
import os
import requests
from functools import lru_cache
from jose import jwt, jwk, JWTError
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Cognito configuration
COGNITO_REGION = os.getenv("AWS_REGION", "ap-south-1")
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
COGNITO_APP_CLIENT_ID = os.getenv("COGNITO_APP_CLIENT_ID", "")

# Admin users (Cognito 'sub' values OR email addresses) - add your email here
ADMIN_EMAILS = {val.strip().lower() for val in os.getenv("ADMIN_EMAILS", os.getenv("ADMIN_USER_IDS", "")).split(",") if val.strip()}

JWKS_URL = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}/.well-known/jwks.json"
ISSUER = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"

security = HTTPBearer()


@lru_cache(maxsize=1)
def _get_cognito_jwks() -> dict:
    """Fetch Cognito's public JWKs for token verification."""
    response = requests.get(JWKS_URL, timeout=10)
    response.raise_for_status()
    return response.json()


def _get_signing_key(token: str) -> dict:
    """Find the correct signing key from JWKS based on the token's 'kid' header."""
    jwks = _get_cognito_jwks()
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")

    for key in jwks.get("keys", []):
        if key["kid"] == kid:
            return key

    # Key not found - maybe keys rotated, clear cache and retry
    _get_cognito_jwks.cache_clear()
    jwks = _get_cognito_jwks()
    for key in jwks.get("keys", []):
        if key["kid"] == kid:
            return key

    raise HTTPException(status_code=401, detail="Unable to find signing key")


def verify_cognito_token(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> dict:
    """
    Verify a Cognito JWT ID token and return the decoded payload.

    Returns dict with keys: uid (sub), email, name, is_admin.
    Raises HTTPException 401 if token is invalid.
    """
    token = credentials.credentials

    try:
        signing_key = _get_signing_key(token)

        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            audience=COGNITO_APP_CLIENT_ID,
            issuer=ISSUER,
            options={"verify_at_hash": False},
        )

        uid = payload.get("sub", "")
        
        # Build display name - Google Sign-In uses given_name/family_name
        given_name = payload.get("given_name", "")
        family_name = payload.get("family_name", "")
        cognito_name = payload.get("name", "")
        email = payload.get("email", "")
        
        display_name = cognito_name
        if not display_name and given_name:
            display_name = f"{given_name} {family_name}".strip() if family_name else given_name
        if not display_name:
            display_name = email.split("@")[0] if email else "User"
        
        return {
            "uid": uid,
            "email": email,
            "name": display_name,
            "is_admin": uid in ADMIN_EMAILS or email.lower() in ADMIN_EMAILS,
        }

    except JWTError as e:
        _get_cognito_jwks.cache_clear()
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


def require_admin(user_info: dict) -> dict:
    """Check if the authenticated user is an admin. Raises 403 if not."""
    if not user_info.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user_info
