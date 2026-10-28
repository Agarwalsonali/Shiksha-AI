# import os
# import weaviate
# from weaviate.classes.init import Auth, AdditionalConfig, Timeout
# from dotenv import load_dotenv

# load_dotenv()

# # --- Connection Details ---
# # Use environment variables or your hardcoded strings
# WEAVIATE_URL = os.environ.get("WEAVIATE_URL", "your-cluster.c0.asia-southeast1.gcp.weaviate.cloud")
# WEAVIATE_API_KEY = os.environ.get("WEAVIATE_API_KEY", "your-wcd-api-key")
# INDEX_NAME = "NcertBooks"

# # 1. Connect to WEAVIATE CLOUD with resilient settings
# client = weaviate.connect_to_weaviate_cloud(
#     cluster_url=WEAVIATE_URL,
#     auth_credentials=Auth.api_key(WEAVIATE_API_KEY),
#     # Critical: Skip the startup health checks that are failing
#     skip_init_checks=True, 
#     # Critical: Give the network more time to respond (60s instead of default ~2s)
#     additional_config=AdditionalConfig(
#         timeout=Timeout(init=60, query=60, insert=120)
#     )
# )

# def delete_collection():
#     print(f"🔗 Connecting to {WEAVIATE_URL}...")
#     try:
#         # Check if the collection exists
#         if client.collections.exists(INDEX_NAME):
#             print(f"🗑️ Deleting collection: {INDEX_NAME}...")
#             client.collections.delete(INDEX_NAME)
#             print("✅ Collection deleted successfully. Your Cloud DB is now clean.")
#         else:
#             print(f"ℹ️ Collection '{INDEX_NAME}' was not found. Nothing to delete.")
#     except Exception as e:
#         print(f"❌ Error during deletion: {e}")
#     finally:
#         client.close()
#         print("🔌 Connection closed.")

# if __name__ == "__main__":
#     delete_collection()