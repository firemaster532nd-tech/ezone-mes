import pypdf

try:
    reader = pypdf.PdfReader(r"C:\Users\edwar\OneDrive\ezone-mes\upload\웰스홈 실란트 거래명세표 260508.PDF")
    with open("pdf_content.txt", "w", encoding="utf-8") as f:
        f.write(f"Total Pages: {len(reader.pages)}\n")
        for i, page in enumerate(reader.pages):
            f.write(f"--- Page {i+1} ---\n")
            f.write(page.extract_text() or "")
            f.write("\n")
    print("Done writing pdf_content.txt")
except Exception as e:
    print("Error parsing PDF:", str(e))
