import os
import weaviate
from weaviate.classes.init import Auth
from langchain_weaviate import WeaviateVectorStore
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from dotenv import load_dotenv

load_dotenv()


# --- Configuration ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("Missing required embedding environment variable: OPENAI_API_KEY")

# Expanded path to handle the tilde (~)
BASE_DIR = os.path.expanduser("~/Desktop/data/cbse")
INDEX_NAME = "NCERTChunks"

# 1. Connect to LOCAL Weaviate
try:
    client = weaviate.connect_to_local(
        host="localhost",
        port=8080,
        grpc_port=50051,
        headers={
            "X-OpenAI-Api-Key": OPENAI_API_KEY
        }
    )
    print("✅ Connected to Weaviate")
except Exception as e:
    print(f"❌ Failed to connect: {e}")
    exit(1)

# 2. Setup LangChain Components
# embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")
text_splitter = RecursiveCharacterTextSplitter(chunk_size=600, chunk_overlap=80)

def ingest_data():
    if not client.is_ready():
        print("❌ Local Weaviate is not ready.")
        return

    # Check if directory actually exists
    if not os.path.exists(BASE_DIR):
        print(f"❌ Error: The directory {BASE_DIR} was not found.")
        return

    print(f"📂 Scanning directory: {BASE_DIR}")
    failed_files = []
    
    for class_folder in ["class11", "class12"]:
        class_path = os.path.join(BASE_DIR, class_folder)
        if not os.path.exists(class_path):
            print(f"⚠️ Skipping missing folder: {class_folder}")
            continue
        
        for subject_folder in os.listdir(class_path):
            subject_path = os.path.join(class_path, subject_folder)
            if not os.path.isdir(subject_path): continue
            
            for file in os.listdir(subject_path):
                if file.endswith(".pdf"):
                    file_path = os.path.join(subject_path, file)
                    chapter_no = file.split('_')[0]
                    
                    print(f"🔄 Processing: {class_folder} > {subject_folder} > {file}")

                    try:
                        loader = PyPDFLoader(file_path)
                        docs = loader.load()
                        chunks = text_splitter.split_documents(docs)
                        
                        if not chunks:
                            print(f"⚠️ No text found in {file}")
                            continue

                        # Apply metadata to every chunk
                        for chunk in chunks:
                            chunk.metadata = {
                                "board": "cbse",
                                "class_name": class_folder,
                                "subject": subject_folder,
                                "chapter_no": chapter_no,
                                "source": file
                            }

                        # Upload to Weaviate
                        WeaviateVectorStore.from_documents(
                            chunks, 
                            embeddings, 
                            client=client, 
                            index_name=INDEX_NAME
                        )
                        print(f"✅ Indexed {file}")
                    except Exception as e:
                        print(f"❌ Error skipping {file}: {e}")
                        failed_files.append((file, str(e)))

    print("\n--- Summary ---")
    print(f"Failed: {len(failed_files)}")
    if failed_files:
        for f, err in failed_files:
            print(f" - {f}: {err}")

try:
    ingest_data()
finally:
    client.close()