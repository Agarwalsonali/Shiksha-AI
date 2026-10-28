import os
import gc
from pathlib import Path
from collections import defaultdict
import weaviate
from langchain_weaviate import WeaviateVectorStore
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings


# Load environment variables
load_dotenv()

# Configuration
DATA_DIR = Path("../data")
WEAVIATE_URL = os.getenv("WEAVIATE_URL", "http://localhost:8080")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
COLLECTION_NAME = "NCERTChunks"
EMBEDDING_MODEL = "text-embedding-ada-002"
CHUNK_SIZE = 600
CHUNK_OVERLAP = 80


def setup_weaviate_client():
    """Connect to Weaviate instance"""
    try:
        client = weaviate.connect_to_local(
            host="localhost",
            port=8080,
            grpc_port=50051,
        )
        if not client.is_ready():
            raise ConnectionError("Weaviate is not ready")
        print("✅ Connected to Weaviate")
        return client
    except Exception as e:
        print(f"❌ Failed to connect to Weaviate: {e}")
        raise


def extract_metadata_from_path(pdf_path: Path) -> dict:
    """Extract metadata from folder structure"""
    parts = pdf_path.parts
    data_idx = parts.index("data")

    board = parts[data_idx + 1].upper()  # cbse -> CBSE
    class_folder = parts[data_idx + 2]  # class11
    subject = parts[data_idx + 3].capitalize()  # chemistry -> Chemistry
    chapter_no = pdf_path.stem.split("_")[0]  # 01_chapter -> 01

    # Clean class field (class11 -> 11)
    class_num = class_folder.replace("class", "")

    return {
        "board": board,
        "class_name": class_num,
        "subject": subject,
        "chapter_no": chapter_no,
        "source": pdf_path.name,
    }


def process_pdfs():
    """Main pipeline to process all PDFs using LangChain"""
    print("Starting PDF processing pipeline...\n")

    # Validate environment
    if not GOOGLE_API_KEY:
        raise ValueError("GOOGLE_API_KEY not found in environment variables")

    if not DATA_DIR.exists():
        raise ValueError(f"Data directory not found: {DATA_DIR}")

    # Setup components
    client = setup_weaviate_client()
    embeddings = GoogleGenerativeAIEmbeddings(model=EMBEDDING_MODEL)
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP
    )

    try:
        # Find all PDFs and group by subject
        pdf_files = list(DATA_DIR.rglob("*.pdf"))
        print(f"Found {len(pdf_files)} PDF files")

        subject_groups = defaultdict(list)
        for pdf_path in pdf_files:
            try:
                metadata = extract_metadata_from_path(pdf_path)
                subject_key = f"{metadata['class_name']}-{metadata['subject']}"
                subject_groups[subject_key].append(pdf_path)
            except Exception:
                continue

        print(f"Organized into {len(subject_groups)} subject groups\n")

        # Process statistics
        total_chunks = 0
        processed_files = 0
        failed_files = []
        subject_stats = {}

        for subject_key in sorted(subject_groups.keys()):
            subject_pdfs = subject_groups[subject_key]
            class_num, subject_name = subject_key.split("-", 1)

            print(f"\n{'='*60}")
            print(f"📚 Class {class_num} - {subject_name} ({len(subject_pdfs)} files)")
            print(f"{'='*60}")

            subject_chunks = 0
            subject_processed = 0

            for pdf_idx, pdf_path in enumerate(subject_pdfs, 1):
                print(f"  [{pdf_idx}/{len(subject_pdfs)}] {pdf_path.name}")

                try:
                    # Extract metadata
                    metadata = extract_metadata_from_path(pdf_path)

                    # Load PDF
                    loader = PyPDFLoader(str(pdf_path))
                    docs = loader.load()

                    if not docs:
                        print(f"    ⊘ Skipping - no content extracted")
                        continue

                    # Split into chunks
                    chunks = text_splitter.split_documents(docs)

                    if not chunks:
                        print(f"    ⊘ Skipping - no valid chunks")
                        continue

                    # Apply metadata to all chunks
                    for chunk in chunks:
                        chunk.metadata = metadata

                    # Upload to Weaviate
                    WeaviateVectorStore.from_documents(
                        chunks, embeddings, client=client, index_name=COLLECTION_NAME
                    )

                    chunk_count = len(chunks)
                    subject_chunks += chunk_count
                    total_chunks += chunk_count
                    subject_processed += 1
                    processed_files += 1

                    print(f"    ✓ Indexed {chunk_count} chunks")

                    # Cleanup
                    del docs, chunks
                    if processed_files % 10 == 0:
                        gc.collect()

                except Exception as e:
                    print(f"    ✗ Error: {e}")
                    failed_files.append((pdf_path.name, str(e)))
                    continue

            # Subject summary
            print(f"\n  📊 {subject_name} Summary:")
            print(f"     Files processed: {subject_processed}/{len(subject_pdfs)}")
            print(f"     Chunks created: {subject_chunks}")

            subject_stats[subject_key] = {
                "processed": subject_processed,
                "total": len(subject_pdfs),
                "chunks": subject_chunks,
            }

        # Final summary
        print(f"\n\n{'='*60}")
        print(f"✅ PIPELINE COMPLETE")
        print(f"{'='*60}")
        print(f"Total files processed: {processed_files}/{len(pdf_files)}")
        print(f"Total chunks created: {total_chunks}")
        print(f"Failed files: {len(failed_files)}")

        if failed_files:
            print(f"\n⚠️ Failed Files:")
            for filename, error in failed_files[:10]:  # Show first 10
                print(f"  - {filename}: {error[:80]}...")

        print(f"\n📚 Subject-wise Summary:")
        print(f"{'='*60}")

        for subject_key in sorted(subject_stats.keys()):
            stats = subject_stats[subject_key]
            class_num, subject_name = subject_key.split("-", 1)
            success_rate = (
                (stats["processed"] / stats["total"] * 100) if stats["total"] > 0 else 0
            )
            print(
                f"  Class {class_num} {subject_name:12} : {stats['processed']:3}/{stats['total']:3} files ({success_rate:.0f}%) → {stats['chunks']:5} chunks"
            )

        print(f"{'='*60}\n")

    finally:
        client.close()
        gc.collect()


def main():
    """Main entry point"""
    print("=" * 60)
    print("NCERT PDF to Weaviate Embedding Pipeline (LangChain)")
    print("=" * 60)
    print()

    process_pdfs()


if __name__ == "__main__":
    main()
