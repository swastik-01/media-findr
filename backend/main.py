"""
Media Findr - Multi-Tenant FastAPI Backend

Architecture:
  - One S3 bucket (agba-event-images) with category-based prefixes
  - One Rekognition collection per event
  - DynamoDB for users (credits) and events (metadata)
  - AWS Cognito tokens verified on every authenticated request
  - No ZIP downloads - individual presigned URLs for mobile-friendly access
"""
import os
import io
import uuid
import re
import hashlib

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Query, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from PIL import Image
import boto3

import razorpay
from decimal import Decimal
from auth import verify_cognito_token, require_admin
from db import (
    get_or_create_user,
    get_user,
    deduct_credit,
    add_purchased_credits,
    get_all_users,
    create_event,
    get_event,
    get_user_events,
    get_all_events,
    delete_event as db_delete_event,
    update_event_status,
    increment_event_counts,
    get_admin_stats,
    VALID_EVENT_TYPES,
    get_search_cache,
    set_search_cache,
    increment_guest_search_count,
    get_guest_link,
    save_guest_link,
    list_event_guests,
)

# -------------------------- UTILS --------------------------
PHONE_REGEX = re.compile(r"^\+?[1-9]\d{7,14}$")
# -------------------------- ENV --------------------------
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
BUCKET = os.getenv("S3_BUCKET", "agba-event-images")
RAZORPAY_KEY_ID = (os.getenv("Razorpay_Api_Key") or "").strip()
RAZORPAY_KEY_SECRET = (os.getenv("Razorpay_Key_Secret") or "").strip()

razorpay_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# -------------------------- AWS CLIENTS ------------------
rekognition = boto3.client("rekognition", region_name=AWS_REGION)
s3 = boto3.client("s3", region_name=AWS_REGION)

# -------------------------- FASTAPI ----------------------
app = FastAPI(title="Media Findr API", version="3.0.0")

# In production, restrict to your actual frontend domain via FRONTEND_URL env var
_allowed_origins = [o.strip() for o in os.getenv("FRONTEND_URL", "*").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------- HELPERS ----------------------

def slugify(text: str) -> str:
    """Convert text to a URL-safe slug."""
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def compress_image(file: UploadFile) -> bytes:
    """Compress image to stay under Rekognition's 5MB limit."""
    file.file.seek(0)
    image = Image.open(file.file).convert("RGB")

    for quality in (85, 75, 65, 50):
        buf = io.BytesIO()
        image.save(buf, format="JPEG", quality=quality, optimize=True)
        if buf.tell() <= 5 * 1024 * 1024:
            buf.seek(0)
            return buf.read()

    raise HTTPException(400, "Image too large even after compression")


def presigned_url(key: str, expires: int = 3600) -> str:
    """Generate a presigned S3 URL for downloading."""
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": BUCKET, "Key": key},
        ExpiresIn=expires,
    )


# -------------------------- USER ENDPOINTS ---------------

@app.get("/user/me")
async def get_current_user(user_info: dict = Depends(verify_cognito_token)):
    """Get current user profile + credits. Auto-creates user on first call."""
    user = get_or_create_user(
        uid=user_info["uid"],
        email=user_info["email"],
        name=user_info["name"],
        is_admin=user_info.get("is_admin", False),
    )
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "credits": float(user.get("credits", 0)),
        "is_admin": bool(user.get("is_admin", False)),
        "created_at": user["created_at"],
    }


@app.get("/user/events")
async def list_user_events(user_info: dict = Depends(verify_cognito_token)):
    """List all events owned by the authenticated user."""
    events = get_user_events(user_info["uid"])
    return {
        "events": [
            {
                "event_id": e["event_id"],
                "event_name": e["event_name"],
                "event_type": e["event_type"],
                "image_count": int(e.get("image_count", 0)),
                "face_count": int(e.get("face_count", 0)),
                "status": e["status"],
                "created_at": e["created_at"],
                "expires_at": e.get("expires_at"),
            }
            for e in events
        ]
    }


# -------------------------- EVENT ENDPOINTS --------------

@app.post("/events/create")
async def create_new_event(
    payload: dict,
    user_info: dict = Depends(verify_cognito_token),
):
    """
    Create a new event.
    Body: { "event_name": "AGBA Awards 2026", "event_type": "corporate" }
    
    - Creates a Rekognition collection for the event.
    - Creates a DynamoDB entry.
    - Credits are deducted when images are uploaded (0.01 per image).
    """
    event_name = payload.get("event_name", "").strip()
    event_type = payload.get("event_type", "").strip().lower()

    if not event_name:
        raise HTTPException(400, "event_name is required")
    if event_type not in VALID_EVENT_TYPES:
        raise HTTPException(400, f"event_type must be one of: {', '.join(VALID_EVENT_TYPES)}")

    # Generate unique event ID
    short_id = uuid.uuid4().hex[:8]
    event_slug = slugify(event_name)
    event_id = f"{event_slug}-{short_id}"

    # Rekognition collection
    collection_id = f"event-{event_id}"
    try:
        rekognition.create_collection(CollectionId=collection_id)
    except rekognition.exceptions.ResourceAlreadyExistsException:
        pass

    # S3 prefix (organized by event category)
    s3_prefix = f"{event_type}/{event_id}/images/"

    # DynamoDB entry
    event = create_event(
        event_id=event_id,
        user_id=user_info["uid"],
        event_name=event_name,
        event_type=event_type,
        collection_id=collection_id,
        s3_prefix=s3_prefix,
    )

    return {
        "event_id": event_id,
        "collection_id": collection_id,
        "s3_prefix": s3_prefix,
        "status": "creating",
    }


@app.get("/events/{event_id}/info")
async def get_event_info(event_id: str):
    """
    Public endpoint - returns basic event metadata for guests.
    Used by Results.tsx to check require_guest_details flag before showing the search form.
    """
    event = get_event(event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    return {
        "event_id": event["event_id"],
        "event_name": event["event_name"],
        "status": event.get("status"),
        "expires_at": event.get("expires_at"),
    }




@app.post("/events/{event_id}/upload")
async def upload_event_images(
    event_id: str,
    files: list[UploadFile] = File(...),
    user_info: dict = Depends(verify_cognito_token),
):
    """
    Upload images to an event.
    - Uploads each image to S3 under the event's prefix.
    - Indexes each face into the event's Rekognition collection.
    """
    event = get_event(event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    if event["user_id"] != user_info["uid"] and not user_info.get("is_admin"):
        raise HTTPException(403, "You don't own this event")

    user = get_user(user_info["uid"])
    if not user:
        raise HTTPException(404, "User not found")
    
    cost_per_image = Decimal("0.01")
    user_credits = Decimal(str(user.get("credits", 0)))
    max_images_allowed = int(user_credits / cost_per_image)
    
    if len(files) > max_images_allowed:
        raise HTTPException(
            402,
            f"Insufficient credits. You have {user_credits} credits, allowing up to {max_images_allowed} images. You tried to upload {len(files)}."
        )

    update_event_status(event_id, "uploading")

    uploaded = 0
    faces_indexed = 0
    errors = []

    for file in files:
        if not file.content_type or not file.content_type.startswith("image/"):
            errors.append({"file": file.filename, "error": "Not an image"})
            continue

        try:
            # Compress for Rekognition compatibility
            image_bytes = compress_image(file)

            # Upload to S3
            s3_key = f"{event['s3_prefix']}{file.filename}"
            s3.put_object(
                Bucket=BUCKET,
                Key=s3_key,
                Body=image_bytes,
                ContentType="image/jpeg",
            )
            uploaded += 1

            # Index face in Rekognition
            try:
                response = rekognition.index_faces(
                    CollectionId=event["collection_id"],
                    Image={"S3Object": {"Bucket": BUCKET, "Name": s3_key}},
                    ExternalImageId=file.filename,
                    DetectionAttributes=["DEFAULT"],
                    MaxFaces=10,
                )
                faces_indexed += len(response.get("FaceRecords", []))
            except Exception as e:
                # Image uploaded but no face detected — this is OK
                errors.append({"file": file.filename, "error": f"No face detected: {str(e)}"})

        except Exception as e:
            errors.append({"file": file.filename, "error": str(e)})

    # Deduct credits for successful uploads
    final_cost = Decimal(str(uploaded)) * cost_per_image
    if final_cost > Decimal("0"):
        deduct_credit(user_info["uid"], final_cost)

    # Update counts in DynamoDB
    increment_event_counts(event_id, images=uploaded, faces=faces_indexed)
    update_event_status(event_id, "active")

    return {
        "uploaded": uploaded,
        "faces_indexed": faces_indexed,
        "errors": errors,
    }


# -------------------------- GUEST SEARCH -----------------

@app.get("/events/{event_id}/info")
async def get_event_info(event_id: str):
    """Public info endpoint for guests to see event name."""
    event = get_event(event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    return {
        "event_id": event_id,
        "event_name": event["event_name"],
        "status": event.get("status"),
        "image_count": event.get("image_count", 0),
    }


@app.post("/events/{event_id}/check-guest")
async def check_guest(
    event_id: str,
    phone: str = Form(...),
    guest_id: str = Form(""),
):
    """Check if a guest has already performed a search and link their identity."""
    if not PHONE_REGEX.match(phone):
        raise HTTPException(400, "Invalid phone number format")
    
    event = get_event(event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    
    link = get_guest_link(phone, event_id)
    if not link:
        return {"found": False}
    
    face_id = link["face_id"]
    cache_key = f"face#{face_id}"
    cache_data = get_search_cache(cache_key, event_id)
    
    if cache_data and cache_data.get("results"):
        print(f"[DEBUG] Cache HIT for FaceID: {face_id} (Event: {event_id})")
        results = cache_data["results"]
        fresh_results = []
        for r in results:
            image_key = f"{event['s3_prefix']}{r['fileName']}"
            fresh_results.append({
                "id": r["id"],
                "fileName": r["fileName"],
                "similarity": r["similarity"],
                "url": presigned_url(image_key),
                "downloadUrl": presigned_url(image_key, expires=7200),
            })
        
        # Update analytics on cache hit
        save_guest_link(phone, event_id, link.get("name", "Guest"), face_id)

        return {
            "found": True,
            "name": link.get("name"),
            "event_name": event["event_name"],
            "total_matches": len(fresh_results),
            "results": sorted(fresh_results, key=lambda x: x["similarity"], reverse=True),
        }
    
    # If not in cache, we need to do one face-id search
    print(f"[DEBUG] Cache MISS for FaceID: {face_id} (Event: {event_id}) - Falling back to Rekognition")
    try:
        response = rekognition.search_faces(
            CollectionId=event["collection_id"],
            FaceId=face_id,
            FaceMatchThreshold=80,
            MaxFaces=150,
        )
        
        results = []
        cacheable_results = []
        seen = set()
        
        for match in response.get("FaceMatches", []):
            face = match["Face"]
            similarity = round(match["Similarity"], 2)
            filename = face.get("ExternalImageId")
            if not filename or filename in seen: continue
            seen.add(filename)
            
            image_key = f"{event['s3_prefix']}{filename}"
            cacheable_results.append({"id": face["FaceId"], "fileName": filename, "similarity": Decimal(str(similarity))})
            results.append({
                "id": face["FaceId"], "fileName": filename, "similarity": similarity,
                "url": presigned_url(image_key), "downloadUrl": presigned_url(image_key, expires=7200)
            })
            
        set_search_cache(cache_key, event_id, event.get("image_count", 0), cacheable_results)
        
        # Increment search count and update last_search time
        save_guest_link(phone, event_id, link.get("name", "Guest"), face_id)

        return {
            "found": True,
            "name": link.get("name"),
            "event_name": event["event_name"],
            "total_matches": len(results),
            "results": sorted(results, key=lambda x: x["similarity"], reverse=True),
        }
    except Exception as e:
        print(f"Error searching by face_id: {e}")
        return {"found": False}


@app.get("/events/{event_id}/guests")
async def get_event_guests_list(event_id: str, user_info: dict = Depends(verify_cognito_token)):
    """Organizer endpoint to see guest search analytics."""
    event = get_event(event_id)
    if not event or event.get("user_id") != user_info["uid"]:
        raise HTTPException(403, "Not authorized to view this event's analytics")
    
    guests = list_event_guests(event_id)
    return {"guests": guests}


@app.post("/events/{event_id}/search")
async def search_by_image(
    event_id: str,
    file: UploadFile = File(...),
    guest_id: str = Form(""),
    name: str = Form(None),
    phone: str = Form(None),
):
    """
    Includes 3-attempt rate limiting per guest device and search caching.
    """
    event = get_event(event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    if event.get("status") != "active":
        raise HTTPException(400, "Event is not active")

    # Check expiration
    expires_at_str = event.get("expires_at")
    if expires_at_str:
        from datetime import datetime, timezone
        if datetime.fromisoformat(expires_at_str) < datetime.now(timezone.utc):
            raise HTTPException(400, "Event has expired")

    if not guest_id:
        raise HTTPException(400, "guest_id is required")

    # 1. Rate Limiting Check (global guest searches)
    cache_data_global = get_search_cache(guest_id, event_id)
    if cache_data_global and cache_data_global.get("search_count", 0) >= 3:
        raise HTTPException(429, "You have reached the maximum of 3 searches for this event.")

    # 2. Check Image-Specific Cache
    image_bytes = await file.read()
    image_hash = hashlib.md5(image_bytes).hexdigest()
    await file.seek(0)
    # Use a unique cache key for THIS image ONLY (global per event)
    image_cache_key = f"img#{image_hash}"
    cache_data = get_search_cache(image_cache_key, event_id)

    # 2. Check Cache
    if cache_data and cache_data.get("results"):
        # Cache strategy: return cache ONLY if event image_count hasn't changed.
        cached_count = int(cache_data.get("image_count", 0))
        event_count = int(event.get("image_count", 0))
        
        if cached_count == event_count and event_count > 0:
            print(f"[DEBUG] Cache HIT for ImageHash: {image_hash} (Event: {event_id})")
            # Re-generate presigned URLs since they expire
            results = cache_data["results"]
            fresh_results = []
            for r in results:
                image_key = f"{event['s3_prefix']}{r['fileName']}"
                fresh_results.append({
                    "id": r["id"],
                    "fileName": r["fileName"],
                    "similarity": r["similarity"],
                    "url": presigned_url(image_key),
                    "downloadUrl": presigned_url(image_key, expires=7200),
                })
            
            # Increment search count and return cached results
            increment_guest_search_count(guest_id, event_id)
            
            # Update guest analytics if identity is known
            if phone and results:
                top_face_id = sorted(results, key=lambda x: x["similarity"], reverse=True)[0].get("id")
                if top_face_id:
                    save_guest_link(phone, event_id, name or "Guest", top_face_id)
                    
            print(f"DEBUG: [CACHE HIT] Returning results for {image_cache_key}")
                
            return {
                "event_name": event["event_name"],
                "total_matches": len(fresh_results),
                "results": sorted(fresh_results, key=lambda x: x["similarity"], reverse=True),
            }

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Invalid image")

    print(f"DEBUG: [CACHE MISS] Performing fresh Rekognition search for {image_cache_key}")

    # Compress the selfie
    image_bytes = compress_image(file)

    # Upload selfie to a temp location
    temp_key = f"temp-search/{uuid.uuid4()}.jpg"
    s3.put_object(
        Bucket=BUCKET,
        Key=temp_key,
        Body=image_bytes,
        ContentType="image/jpeg",
    )

    try:
        # Search the event's collection
        response = rekognition.search_faces_by_image(
            CollectionId=event["collection_id"],
            Image={"S3Object": {"Bucket": BUCKET, "Name": temp_key}},
            FaceMatchThreshold=80,
            MaxFaces=150,
        )

        results = []
        cacheable_results = []
        seen = set()

        for match in response.get("FaceMatches", []):
            face = match["Face"]
            similarity = round(match["Similarity"], 2)
            filename = face.get("ExternalImageId")

            if not filename or filename in seen:
                continue
            seen.add(filename)

            image_key = f"{event['s3_prefix']}{filename}"
            
            cacheable_results.append({
                "id": face["FaceId"],
                "fileName": filename,
                "similarity": Decimal(str(similarity)),
            })
            
            results.append({
                "id": face["FaceId"],
                "fileName": filename,
                "similarity": similarity,
                "url": presigned_url(image_key),
                "downloadUrl": presigned_url(image_key, expires=7200),
            })

        # Save to Cache — increment happens ONCE at the end
        # Save to Cache — using the image-specific key
        set_search_cache(image_cache_key, event_id, event.get("image_count", 0), cacheable_results)
        
        # LINK GUEST IDENTITY (NEW)
        if phone and results:
            top_face_id = sorted(results, key=lambda x: x["similarity"], reverse=True)[0]["id"]
            save_guest_link(phone, event_id, name or "Guest", top_face_id)
            # Also cache by face_id for future check-guest hits
            set_search_cache(f"face#{top_face_id}", event_id, event.get("image_count", 0), cacheable_results)

        # Increment search count on the GLOBAL guest_id key
        increment_guest_search_count(guest_id, event_id)

        return {
            "event_name": event["event_name"],
            "total_matches": len(results),
            "results": sorted(results, key=lambda x: x["similarity"], reverse=True),
        }

    except rekognition.exceptions.InvalidParameterException:
        raise HTTPException(400, "No face detected in the image")
    except Exception as e:
        print(f"ERROR: Search failed: {str(e)}")
        raise HTTPException(500, f"Search failed: {str(e)}")
    finally:
        # Cleanup temp search file from S3 to save costs
        try:
            s3.delete_object(Bucket=BUCKET, Key=temp_key)
        except:
            pass


# -------------------------- PAYMENT ENDPOINTS ------------

@app.post("/payments/create-order")
async def create_payment_order(
    payload: dict,
    user_info: dict = Depends(verify_cognito_token)
):
    """
    Create a Razorpay order.
    Payload should contain 'amount' in INR (e.g. 499) and 'credits' to be added.
    """
    if not razorpay_client:
        raise HTTPException(500, "Razorpay is not configured on the server")

    amount = payload.get("amount")
    if not amount:
        raise HTTPException(400, "amount is required")

    amount_in_paise = int(float(amount) * 100)

    order_data = {
        "amount": amount_in_paise,
        "currency": "INR",
        "receipt": f"rcpt_{user_info['uid'][-12:]}_{uuid.uuid4().hex[:8]}",
        "notes": {
            "user_id": user_info["uid"],
            "credits": str(payload.get("credits", 0))
        }
    }

    try:
        order = razorpay_client.order.create(data=order_data)
        return {
            "id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "key_id": RAZORPAY_KEY_ID
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to create order: {str(e)}")


@app.post("/payments/verify")
async def verify_payment(
    payload: dict,
    user_info: dict = Depends(verify_cognito_token)
):
    """
    Verify Razorpay payment signature and add credits to user.
    """
    if not razorpay_client:
        raise HTTPException(500, "Razorpay is not configured")

    razorpay_order_id = payload.get("razorpay_order_id")
    razorpay_payment_id = payload.get("razorpay_payment_id")
    razorpay_signature = payload.get("razorpay_signature")
    credits_to_add = payload.get("credits")
    amount_paid = payload.get("amount")

    if not all([razorpay_order_id, razorpay_payment_id, razorpay_signature, credits_to_add, amount_paid]):
        raise HTTPException(400, "Missing payment verification parameters")

    try:
        razorpay_client.utility.verify_payment_signature({
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        })
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(400, "Invalid payment signature")

    try:
        tier = "Business" if int(credits_to_add) >= 50 else "Starter"
        add_purchased_credits(
            uid=user_info["uid"], 
            amount_paid=Decimal(str(amount_paid)), 
            credits_added=Decimal(str(credits_to_add)),
            tier=tier
        )
        return {"status": "success", "message": f"Added {credits_to_add} credits"}
    except Exception as e:
        raise HTTPException(500, f"Failed to update user credits: {str(e)}")


# -------------------------- ADMIN ENDPOINTS --------------

@app.get("/admin/users")
async def admin_list_users(user_info: dict = Depends(verify_cognito_token)):
    require_admin(user_info)
    users = get_all_users()
    return {
        "users": [
            {
                "user_id": u.get("user_id"),
                "email": u.get("email"),
                "name": u.get("name"),
                "credits": float(u.get("credits", 0)),
                "credits_used": float(u.get("credits_used", 0)),
                "total_spent": float(u.get("total_spent", 0)),
                "is_admin": u.get("is_admin", False),
                "created_at": u.get("created_at"),
            }
            for u in users
        ]
    }


@app.get("/admin/events")
async def admin_list_all_events(user_info: dict = Depends(verify_cognito_token)):
    """List all events across all users. Admin only."""
    require_admin(user_info)
    events = get_all_events()
    users = get_all_users()
    user_map = {u.get("user_id"): u for u in users}
    
    return {
        "events": [
            {
                "event_id": e["event_id"],
                "event_name": e["event_name"],
                "event_type": e["event_type"],
                "image_count": int(e.get("image_count", 0)),
                "face_count": int(e.get("face_count", 0)),
                "status": e.get("status", "unknown"),
                "created_at": e.get("created_at", ""),
                "expires_at": e.get("expires_at"),
                "creator_name": user_map.get(e.get("user_id"), {}).get("name", "Unknown"),
                "creator_email": user_map.get(e.get("user_id"), {}).get("email", "Unknown"),
            }
            for e in events
        ]
    }


@app.get("/admin/stats")
async def admin_get_stats(user_info: dict = Depends(verify_cognito_token)):
    """Get aggregate platform stats + live system config. Admin only."""
    require_admin(user_info)
    base = get_admin_stats()
    base["region"] = AWS_REGION
    base["bucket"] = BUCKET
    base["auth_provider"] = "AWS Cognito"
    return base


@app.delete("/admin/events/{event_id}")
async def admin_delete_event(
    event_id: str,
    user_info: dict = Depends(verify_cognito_token),
):
    """
    Delete an event - removes Rekognition collection, S3 images, and DynamoDB entry.
    Admin only.
    """
    require_admin(user_info)

    event = get_event(event_id)
    if not event:
        raise HTTPException(404, "Event not found")

    # Delete Rekognition collection
    try:
        rekognition.delete_collection(CollectionId=event["collection_id"])
    except Exception:
        pass  # Collection may not exist

    # Delete all S3 objects under the event s prefix
    try:
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=BUCKET, Prefix=event["s3_prefix"]):
            objects = page.get("Contents", [])
            if objects:
                s3.delete_objects(
                    Bucket=BUCKET,
                    Delete={"Objects": [{"Key": obj["Key"]} for obj in objects]},
                )
    except Exception:
        pass

    # Delete DynamoDB entry
    db_delete_event(event_id)

    return {"message": f"Event {event_id} deleted successfully"}


@app.post("/admin/events/{event_id}/reindex")
async def admin_reindex_event(
    event_id: str,
    user_info: dict = Depends(verify_cognito_token),
):
    """
    Re-index all images in an event s S3 prefix into Rekognition.
    Admin only. Useful if the collection was corrupted or recreated.
    """
    require_admin(user_info)

    event = get_event(event_id)
    if not event:
        raise HTTPException(404, "Event not found")

    # Recreate Rekognition collection
    try:
        rekognition.delete_collection(CollectionId=event["collection_id"])
    except Exception:
        pass
    rekognition.create_collection(CollectionId=event["collection_id"])

    # Re-index all images
    faces_indexed = 0
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=BUCKET, Prefix=event["s3_prefix"]):
        for obj in page.get("Contents", []):
            s3_key = obj["Key"]
            filename = s3_key.split("/")[-1]
            try:
                response = rekognition.index_faces(
                    CollectionId=event["collection_id"],
                    Image={"S3Object": {"Bucket": BUCKET, "Name": s3_key}},
                    ExternalImageId=filename,
                    DetectionAttributes=["DEFAULT"],
                    MaxFaces=10,
                )
                faces_indexed += len(response.get("FaceRecords", []))
            except Exception:
                continue

    # Update DynamoDB counts
    update_event_status(event_id, "active")

    return {"message": f"Re-indexed {faces_indexed} faces for event {event_id}"}


# -------------------------- HEALTH CHECK -----------------

@app.get("/health")
async def health():
    return {"status": "ok", "region": AWS_REGION, "bucket": BUCKET}


# -------------------------- CLEANUP EXPIRED --------------

@app.delete("/admin/cleanup-expired")
async def cleanup_expired_events(
    user_info: dict = Depends(verify_cognito_token),
):
    """
    Phase 9 - Hard delete all expired events.
    For each event where expires_at < now():
      1. Delete the specific S3 prefix (ONLY that event s prefix)
      2. Delete the Rekognition collection
      3. Mark DynamoDB status = 'deleted'
    Admin only. Safe - scoped strictly by event_id prefix.
    """
    require_admin(user_info)

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    all_events = get_all_events()
    expired = [
        e for e in all_events
        if e.get("expires_at")
        and datetime.fromisoformat(e["expires_at"]) < now
        and e.get("status") != "deleted"
    ]

    results = []
    for event in expired:
        event_id = event["event_id"]
        summary = {"event_id": event_id, "event_name": event.get("event_name"), "steps": []}

        # Step 1 - Delete S3 objects under this event s prefix ONLY
        s3_prefix = event.get("s3_prefix", "")
        if s3_prefix:
            try:
                paginator = s3.get_paginator("list_objects_v2")
                deleted_count = 0
                for page in paginator.paginate(Bucket=BUCKET, Prefix=s3_prefix):
                    objects = page.get("Contents", [])
                    if objects:
                        s3.delete_objects(
                            Bucket=BUCKET,
                            Delete={"Objects": [{"Key": obj["Key"]} for obj in objects]},
                        )
                        deleted_count += len(objects)
                summary["steps"].append(f"S3: deleted {deleted_count} objects from {s3_prefix}")
            except Exception as e:
                summary["steps"].append(f"S3 error: {str(e)}")

        # Step 2 — Delete Rekognition collection
        collection_id = event.get("collection_id", "")
        if collection_id:
            try:
                rekognition.delete_collection(CollectionId=collection_id)
                summary["steps"].append(f"Rekognition: collection '{collection_id}' deleted")
            except rekognition.exceptions.ResourceNotFoundException:
                summary["steps"].append("Rekognition: collection already gone")
            except Exception as e:
                summary["steps"].append(f"Rekognition error: {str(e)}")

        # Step 3 — Mark as deleted in DynamoDB (keep metadata for audit trail)
        try:
            update_event_status(event_id, "deleted")
            summary["steps"].append("DynamoDB: status set to 'deleted'")
        except Exception as e:
            summary["steps"].append(f"DynamoDB error: {str(e)}")

        results.append(summary)

    return {
        "cleaned": len(results),
        "total_expired_found": len(expired),
        "details": results,
    }


# -------------------------- LAMBDA HANDLER ---------------
# Uncomment for AWS Lambda deployment:
# from mangum import Mangum
# handler = Mangum(app)


# -------------------------- FRONTEND SERVING -------------
# Serve static files from the frontend/dist directory
# This allows the backend to serve the compiled React app on the same port
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.exists(frontend_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_path, "assets")), name="static")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Serve index.html for any path that isn't a recognized API route
        # This supports React Router's SPA routing
        index_path = os.path.join(frontend_path, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        return JSONResponse(status_code=404, content={"detail": "Frontend build not found"})
else:
    print(f"WARNING: Frontend path not found at {frontend_path}. Frontend will not be served.")
