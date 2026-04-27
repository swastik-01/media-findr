import os
import boto3
from dotenv import load_dotenv

# Load environment variables from the root .env file
load_dotenv("../.env")

AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")

print(f"Connecting to DynamoDB in region: {AWS_REGION}")
dynamodb = boto3.client("dynamodb", region_name=AWS_REGION)

USERS_TABLE_NAME = os.getenv("DYNAMODB_USERS_TABLE", "agba-users")
EVENTS_TABLE_NAME = os.getenv("DYNAMODB_EVENTS_TABLE", "agba-events")
SEARCH_CACHE_TABLE_NAME = os.getenv("DYNAMODB_SEARCH_CACHE_TABLE", "agba-search-cache")
GUEST_LEADS_TABLE_NAME = os.getenv("DYNAMODB_GUEST_LEADS_TABLE", "agba-guest-leads")

def create_users_table():
    try:
        print(f"Creating {USERS_TABLE_NAME} table...")
        dynamodb.create_table(
            TableName=USERS_TABLE_NAME,
            KeySchema=[{"AttributeName": "user_id", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "user_id", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        print(f"Successfully requested {USERS_TABLE_NAME} table creation.")
    except dynamodb.exceptions.ResourceInUseException:
        print(f"{USERS_TABLE_NAME} table already exists.")
    except Exception as e:
        print(f"Error creating {USERS_TABLE_NAME}: {e}")

def create_events_table():
    try:
        print(f"Creating {EVENTS_TABLE_NAME} table...")
        dynamodb.create_table(
            TableName=EVENTS_TABLE_NAME,
            KeySchema=[{"AttributeName": "event_id", "KeyType": "HASH"}],
            AttributeDefinitions=[
                {"AttributeName": "event_id", "AttributeType": "S"},
                {"AttributeName": "user_id", "AttributeType": "S"},
            ],
            GlobalSecondaryIndexes=[
                {
                    "IndexName": "user_id-index",
                    "KeySchema": [{"AttributeName": "user_id", "KeyType": "HASH"}],
                    "Projection": {"ProjectionType": "ALL"},
                }
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        print(f"Successfully requested {EVENTS_TABLE_NAME} table creation.")
    except dynamodb.exceptions.ResourceInUseException:
        print(f"{EVENTS_TABLE_NAME} table already exists.")
    except Exception as e:
        print(f"Error creating {EVENTS_TABLE_NAME}: {e}")

def create_search_cache_table():
    try:
        print(f"Creating {SEARCH_CACHE_TABLE_NAME} table...")
        dynamodb.create_table(
            TableName=SEARCH_CACHE_TABLE_NAME,
            KeySchema=[{"AttributeName": "cache_id", "KeyType": "HASH"}],
            AttributeDefinitions=[{"AttributeName": "cache_id", "AttributeType": "S"}],
            BillingMode="PAY_PER_REQUEST",
        )
        print(f"Successfully requested {SEARCH_CACHE_TABLE_NAME} table creation.")
    except dynamodb.exceptions.ResourceInUseException:
        print(f"{SEARCH_CACHE_TABLE_NAME} table already exists.")
    except Exception as e:
        print(f"Error creating {SEARCH_CACHE_TABLE_NAME}: {e}")

def create_guest_leads_table():
    try:
        print(f"Creating {GUEST_LEADS_TABLE_NAME} table...")
        dynamodb.create_table(
            TableName=GUEST_LEADS_TABLE_NAME,
            KeySchema=[
                {"AttributeName": "event_id", "KeyType": "HASH"},
                {"AttributeName": "email", "KeyType": "RANGE"}
            ],
            AttributeDefinitions=[
                {"AttributeName": "event_id", "AttributeType": "S"},
                {"AttributeName": "email", "AttributeType": "S"}
            ],
            BillingMode="PAY_PER_REQUEST",
        )
        print(f"Successfully requested {GUEST_LEADS_TABLE_NAME} table creation.")
    except dynamodb.exceptions.ResourceInUseException:
        print(f"{GUEST_LEADS_TABLE_NAME} table already exists.")
    except Exception as e:
        print(f"Error creating {GUEST_LEADS_TABLE_NAME}: {e}")

if __name__ == "__main__":
    create_users_table()
    create_events_table()
    create_search_cache_table()
    create_guest_leads_table()
    print("Table creation script completed! It may take a minute for AWS to finish creating them.")
