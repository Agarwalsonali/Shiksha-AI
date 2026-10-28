# NCERT Embedding Pipeline (LangChain)

This pipeline extracts text from NCERT PDFs, chunks them using LangChain's RecursiveCharacterTextSplitter, generates embeddings using Google's Gemini, and stores them in Weaviate for RAG retrieval.

## Setup

1. **Start Weaviate**:
   ```bash
   docker-compose up -d
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env and add your GOOGLE_API_KEY
   ```

3. **Install dependencies**:
   ```bash
   uv sync
   ```

4. **Ensure data directory exists**:
   ```
   ../data/cbse/class11/chemistry/*.pdf
   ../data/cbse/class11/english/*.pdf
   ... etc
   ```

## Usage

Run the complete pipeline:

```bash
uv run python main.py
```

This will:
- Connect to Weaviate
- Process all PDFs in `/data` folder organized by subject
- Extract text with PyPDFLoader (LangChain)
- Chunk text (600 tokens, 80 token overlap) with RecursiveCharacterTextSplitter
- Generate embeddings with Google Gemini `text-embedding-004`
- Store in Weaviate with metadata

## Metadata Structure

Each chunk includes:
```json
{
  "text": "Newton's first law states that...",
  "board": "CBSE",
  "class_name": "11",
  "subject": "Chemistry",
  "chapter_no": "01",
  "source": "01_chapter.pdf"
}
```

## Key Improvements

- **LangChain integration**: Robust document loading and splitting
- **Google Gemini embeddings**: Free tier with good multilingual support (Hindi)
- **Subject-wise progress**: Clear organization and tracking
- **Memory efficient**: Automatic cleanup and batch processing
- **Production ready**: Handles errors gracefully

## Querying (Example)

```python
import weaviate
from langchain_weaviate import WeaviateVectorStore
from langchain_google_genai import GoogleGenerativeAIEmbeddings

client = weaviate.connect_to_local()
embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004")

vectorstore = WeaviateVectorStore(
    client=client,
    index_name="NCERTChunks",
    text_key="text",
    embedding=embeddings
)

# Semantic search
results = vectorstore.similarity_search(
    "What is Newton's first law?",
    k=5,
    filter={"class_name": "11", "subject": "Physics"}
)

for doc in results:
    print(f"Class {doc.metadata['class_name']} - {doc.metadata['subject']}")
    print(doc.page_content[:200])
```

## Performance

- Processes ~150 PDFs in ~20-30 minutes
- Google Gemini API: Free tier (15 requests/min)
- No OpenAI costs
- Handles Hindi/multilingual content properly

## Troubleshooting

- **Weaviate connection error**: Ensure `docker-compose up -d` is running
- **Google API error**: Check your API key in `.env`
- **No PDFs found**: Verify `/data` folder structure
- **Memory issues**: LangChain handles memory efficiently
