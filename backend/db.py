"""
DynamoDB helpers for users and events tables.

Tables:
  - Users: user_id (PK), email, name, credits, is_admin, created_at
  - Events: event_id (PK), user_id (GSI), event_name, event_type,
                 collection_id, s3_prefix, image_count, face_count, status, created_at
"""
import os
import boto3
from datetime import datetime, timezone
from decimal import Decimal
from boto3.dynamodb.conditions import Key, Attr

AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")

dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)

USERS_TABLE_NAME = os.getenv("DYNAMODB_USERS_TABLE", "Users")
EVENTS_TABLE_NAME = os.getenv("DYNAMODB_EVENTS_TABLE", "Events")
SEARCH_CACHE_TABLE_NAME = os.getenv("DYNAMODB_SEARCH_CACHE_TABLE", "SearchCache")

USERS_TABLE = dynamodb.Table(USERS_TABLE_NAME)
EVENTS_TABLE = dynamodb.Table(EVENTS_TABLE_NAME)
SEARCH_CACHE_TABLE = dynamodb.Table(SEARCH_CACHE_TABLE_NAME)
GUEST_LINKS_TABLE_NAME = os.getenv("DYNAMODB_GUEST_LINKS_TABLE", "GuestLinks")
GUEST_LINKS_TABLE = dynamodb.Table(GUEST_LINKS_TABLE_NAME)

# Default credits for new users
DEFAULT_CREDITS = 1

FREE_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", 
    "icloud.com", "aol.com", "protonmail.com", "mail.com"
}


# -------------------------- USERS --------------------------

def get_or_create_user(uid: str, email: str = "", name: str = "", is_admin: bool = False) -> dict:
    """
    Get user by Cognito 'sub'. If user doesn't exist, create with 1 free credit.
    Returns the user dict.
    """
    response = USERS_TABLE.get_item(Key={"user_id": uid})
    user = response.get("Item")

    if user:
        # Update is_admin and credits if needed
        updates = []
        expr_attr_vals = {}
        
        # Ensure admin status is updated if missing
        if is_admin and not user.get("is_admin"):
            updates.append("is_admin = :admin")
            expr_attr_vals[":admin"] = True
            user["is_admin"] = True
        
        # Update name if stored name is empty/email-prefix and a real name is provided
        stored_name = user.get("name", "")
        if name and name != stored_name:
            # Only overwrite if stored name looks like a placeholder
            email_prefix = email.split("@")[0] if "@" in email else ""
            if not stored_name or stored_name == email_prefix or stored_name == "User":
                updates.append("#n = :name")
                expr_attr_vals[":name"] = name
                user["name"] = name
            
        if updates:
            update_expr = "SET " + ", ".join(updates)
            expr_attr_names = {}
            if "#n" in update_expr:
                expr_attr_names["#n"] = "name"
            kwargs = {
                "Key": {"user_id": uid},
                "UpdateExpression": update_expr,
                "ExpressionAttributeValues": expr_attr_vals,
            }
            if expr_attr_names:
                kwargs["ExpressionAttributeNames"] = expr_attr_names
            USERS_TABLE.update_item(**kwargs)
        return user

    # Determine initial credits based on email domain
    # Organization and .edu emails get 0 credits
    domain = email.split("@")[-1].lower() if "@" in email else ""
    is_org = bool(domain) and (domain not in FREE_EMAIL_DOMAINS or domain.endswith(".edu"))
    
    initial_credits = 0 if is_org else DEFAULT_CREDITS

    now = datetime.now(timezone.utc).isoformat()
    user = {
        "user_id": uid,
        "email": email,
        "name": name,
        "credits": initial_credits,
        "is_admin": is_admin,
        "created_at": now,
    }
    USERS_TABLE.put_item(Item=user)
    return user


def get_user(uid: str) -> dict | None:
    """Get user by Cognito sub. Returns None if not found."""
    response = USERS_TABLE.get_item(Key={"user_id": uid})
    return response.get("Item")


def deduct_credit(uid: str, amount: Decimal) -> bool:
    """
    Atomically deduct credit amount from user.
    Returns True if successful, False if insufficient credits.
    Uses a conditional expression to prevent going below 0.
    """
    try:
        USERS_TABLE.update_item(
            Key={"user_id": uid},
            UpdateExpression="SET credits = credits - :amount, credits_used = if_not_exists(credits_used, :zero) + :amount",
            ConditionExpression="credits >= :amount",
            ExpressionAttributeValues={":amount": amount, ":zero": 0},
        )
        return True
    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        return False


def add_purchased_credits(uid: str, amount_paid: Decimal, credits_added: Decimal, tier: str = "Starter"):
    """
    Atomically add credits, record the total amount spent, and update current tier.
    """
    USERS_TABLE.update_item(
        Key={"user_id": uid},
        UpdateExpression="SET credits = credits + :credits, total_spent = if_not_exists(total_spent, :zero) + :paid, current_tier = :tier",
        ExpressionAttributeValues={
            ":credits": credits_added,
            ":paid": amount_paid,
            ":zero": 0,
            ":tier": tier
        },
    )


def get_all_users() -> list[dict]:
    """Get all users for the Admin panel."""
    try:
        response = USERS_TABLE.scan()
        return response.get("Items", [])
    except dynamodb.meta.client.exceptions.ResourceNotFoundException:
        return []


# -------------------------- EVENTS --------------------------

# Valid event categories (maps to S3 bucket prefixes)
VALID_EVENT_TYPES = {"corporate", "college", "wedding", "anniversary", "festive", "custom"}


def create_event(
    event_id: str,
    user_id: str,
    event_name: str,
    event_type: str,
    collection_id: str,
    s3_prefix: str,
) -> dict:
    """Create a new event entry in DynamoDB with expiration based on user tier."""
    from datetime import timedelta
    
    # Fetch user tier to determine expiration
    user = get_user(user_id)
    tier = user.get("current_tier", "Starter") if user else "Starter"
    days_to_expire = 30 if tier == "Business" else 15
    
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(days=days_to_expire)).isoformat()
    
    event = {
        "event_id": event_id,
        "user_id": user_id,
        "event_name": event_name,
        "event_type": event_type,
        "collection_id": collection_id,
        "s3_prefix": s3_prefix,
        "image_count": 0,
        "face_count": 0,
        "status": "creating",
        "created_at": now.isoformat(),
        "expires_at": expires_at,
    }
    EVENTS_TABLE.put_item(Item=event)
    return event


def get_event(event_id: str) -> dict | None:
    """Get event by event_id."""
    response = EVENTS_TABLE.get_item(Key={"event_id": event_id})
    return response.get("Item")


def get_user_events(user_id: str) -> list[dict]:
    """Get all events owned by a user (via GSI)."""
    response = EVENTS_TABLE.query(
        IndexName="user_id-index",
        KeyConditionExpression=Key("user_id").eq(user_id),
    )
    return response.get("Items", [])


def get_all_events() -> list[dict]:
    """Get all events (admin only). Uses a full table scan - OK for small scale."""
    try:
        response = EVENTS_TABLE.scan()
        return response.get("Items", [])
    except dynamodb.meta.client.exceptions.ResourceNotFoundException:
        return []


def delete_event(event_id: str):
    """Delete an event from DynamoDB."""
    EVENTS_TABLE.delete_item(Key={"event_id": event_id})


def update_event_status(event_id: str, status: str):
    """Update event status."""
    EVENTS_TABLE.update_item(
        Key={"event_id": event_id},
        UpdateExpression="SET #s = :status",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":status": status},
    )


def increment_event_counts(event_id: str, images: int = 0, faces: int = 0):
    """Safely increment image and face counts for an event."""
    EVENTS_TABLE.update_item(
        Key={"event_id": event_id},
        UpdateExpression="ADD image_count :i, face_count :f",
        ExpressionAttributeValues={":i": images, ":f": faces},
    )


# -------------------------- AWS COST CONTROL & LEADS -------

def get_search_cache(guest_id: str, event_id: str) -> dict | None:
    cache_key = f"{guest_id}#{event_id}"
    try:
        response = SEARCH_CACHE_TABLE.get_item(Key={"cache_id": cache_key})
        return response.get("Item")
    except dynamodb.meta.client.exceptions.ResourceNotFoundException:
        return None

def set_search_cache(guest_id: str, event_id: str, image_count: int, results: list):
    """
    Save search results to cache WITHOUT touching search_count.
    Uses update_item so an existing search_count is never reset.
    """
    cache_key = f"{guest_id}#{event_id}"
    try:
        SEARCH_CACHE_TABLE.update_item(
            Key={"cache_id": cache_key},
            UpdateExpression="SET guest_id = :g, event_id = :e, image_count = :ic, results = :r, updated_at = :ts",
            ExpressionAttributeValues={
                ":g": guest_id,
                ":e": event_id,
                ":ic": image_count,
                ":r": results,
                ":ts": datetime.now(timezone.utc).isoformat(),
            },
        )
    except dynamodb.meta.client.exceptions.ResourceNotFoundException:
        pass

def increment_guest_search_count(guest_id: str, event_id: str) -> int:
    """Increment the number of AWS Rekognition searches a guest has performed."""
    cache_key = f"{guest_id}#{event_id}"
    try:
        response = SEARCH_CACHE_TABLE.update_item(
            Key={"cache_id": cache_key},
            UpdateExpression="ADD search_count :one",
            ExpressionAttributeValues={":one": 1},
            ReturnValues="UPDATED_NEW"
        )
        return int(response["Attributes"].get("search_count", 1))
    except dynamodb.meta.client.exceptions.ResourceNotFoundException:
        return 1

# -------------------------- GUEST LINKS (COST SAVING) -------

def get_guest_link(phone: str, event_id: str) -> dict | None:
    """Check if a guest with this phone number has already linked a face in this event."""
    try:
        response = GUEST_LINKS_TABLE.get_item(Key={"phone": phone, "event_id": event_id})
        return response.get("Item")
    except Exception as e:
        print(f"Error fetching guest link: {e}")
        return None

def save_guest_link(phone: str, event_id: str, name: str, face_id: str):
    """Link a guest's phone/name to a specific face ID for an event and increment search count."""
    try:
        GUEST_LINKS_TABLE.update_item(
            Key={"phone": phone, "event_id": event_id},
            UpdateExpression="SET #n = :name, face_id = :face_id, last_search = :now, search_count = if_not_exists(search_count, :zero) + :one",
            ExpressionAttributeNames={"#n": "name"},
            ExpressionAttributeValues={
                ":name": name,
                ":face_id": face_id,
                ":now": datetime.now(timezone.utc).isoformat(),
                ":one": 1,
                ":zero": 0
            }
        )
    except Exception as e:
        print(f"Error saving guest link: {e}")

def list_event_guests(event_id: str) -> list:
    """List all guests who have searched in a specific event."""
    try:
        # Scan with filter (GSI would be better for scale, but Scan works for small/mid events)
        response = GUEST_LINKS_TABLE.scan(
            FilterExpression=Attr("event_id").eq(event_id)
        )
        items = response.get("Items", [])
        
        # Convert Decimals to ints/floats for JSON
        for item in items:
            if "search_count" in item:
                item["search_count"] = int(item["search_count"])
        
        return items
    except Exception as e:
        print(f"Error listing event guests: {e}")
        return []

# Guest Leads features


def get_admin_stats() -> dict:
    """Get aggregate stats and revenue analytics for admin dashboard."""
    events = get_all_events()
    users = get_all_users()
    
    total_images = sum(int(e.get("image_count", 0)) for e in events)
    total_faces = sum(int(e.get("face_count", 0)) for e in events)
    total_revenue = sum(float(u.get("total_spent", 0)) for u in users)
    
    # Calculate revenue trends
    from datetime import datetime, timedelta, timezone
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(days=1)
    month_ago = now - timedelta(days=30)
    year_ago = now - timedelta(days=365)
    
    revenue_daily = 0
    revenue_monthly = 0
    revenue_yearly = 0
    
    for u in users:
        # Note: We assume the user's total_spent was mostly recent if we don't have a 
        # separate transaction table, but for accurate day/month/year, 
        # we check the user's creation/update date.
        # IMPROVEMENT: In a real prod app, we'd scan a 'Transactions' table.
        # For now, we use the user's timestamps as a proxy.
        created_at = datetime.fromisoformat(u.get("created_at", now.isoformat()))
        spent = float(u.get("total_spent", 0))
        
        if created_at > day_ago: revenue_daily += spent
        if created_at > month_ago: revenue_monthly += spent
        if created_at > year_ago: revenue_yearly += spent

    return {
        "total_users": len(users),
        "total_events": len(events),
        "total_images": total_images,
        "total_faces": total_faces,
        "total_revenue": total_revenue,
        "revenue_daily": revenue_daily,
        "revenue_monthly": revenue_monthly,
        "revenue_yearly": revenue_yearly,
    }
