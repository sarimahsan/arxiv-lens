import requests
import json
from services.citation_graph import build_citation_graph
import time

# Test papers
test_arxiv_ids = [
    "1706.03762",  # Transformer (Attention is All You Need) - better for testing
    "2310.06825",  # LLaMA 2
    "2005.11401",  # ELECTRA
]

def test_citation_graph(arxiv_id: str):
    """Test the build_citation_graph function with detailed output."""
    print(f"\n{'='*80}")
    print(f"🧪 Testing Citation Graph: {arxiv_id}")
    print(f"{'='*80}\n")
    
    start_time = time.time()
    
    try:
        # Call the function
        print("⏳ Fetching citation graph from Semantic Scholar...\n")
        graph = build_citation_graph(arxiv_id)
        elapsed = time.time() - start_time
        
        nodes = graph.get("nodes", [])
        links = graph.get("links", [])
        
        print(f"\n✅ Completed in {elapsed:.2f}s\n")
        
        print(f"📊 Graph Statistics:")
        print(f"   • Nodes (papers): {len(nodes)}")
        print(f"   • Links (citations): {len(links)}")
        
        # Show main paper
        if nodes:
            main = nodes[0]
            print(f"\n📄 Main Paper:")
            print(f"   • ID: {main.get('id')}")
            print(f"   • Title: {main.get('title')}")
            print(f"   • Type: {main.get('type')}")
        else:
            print(f"\n⚠️  No data fetched - API may be rate limiting")
        
        # Show first few references
        if len(nodes) > 1:
            print(f"\n🔗 First 5 References:")
            for i, node in enumerate(nodes[1:6], 1):
                title = node.get('title', 'Unknown')[:60]
                print(f"   {i}. {title}...")
        
        # Show links
        if links:
            print(f"\n🔗 Citation Links ({len(links)} total):")
            for i, link in enumerate(links[:3], 1):
                print(f"   {i}. {link.get('source', '?')} → {link.get('target', '?')}")
        else:
            print(f"\n⚠️  No links in graph (expecting {len(nodes)-1} links)")
            print(f"   First node: {nodes[0].get('id') if nodes else 'N/A'}")
            if len(nodes) > 1:
                print(f"   Second node: {nodes[1].get('id')}")
        
        # Full response
        print(f"\n📋 Full Response (first 500 chars):")
        print(json.dumps(graph, indent=2)[:500])
        
        return len(nodes) > 0
        
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_direct_api():
    """Test the API directly to see actual response."""
    print(f"\n{'='*80}")
    print(f"🔍 Testing S2 API Directly")
    print(f"{'='*80}\n")
    
    arxiv_id = "1706.03762"
    url = f"https://api.semanticscholar.org/graph/v1/paper/ARXIV:{arxiv_id}?fields=paperId,title,references"
    
    print(f"URL: {url}\n")
    
    try:
        print("⏳ Sending request...\n")
        response = requests.get(url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
        })
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Time: {response.elapsed.total_seconds():.2f}s")
        print(f"Content Length: {len(response.text)} bytes\n")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Success! Raw Response:")
            print(json.dumps(data, indent=2)[:1000])
        else:
            print(f"❌ Error Response:")
            print(response.text[:500])
            
    except Exception as e:
        print(f"✗ Request failed: {e}")


def main():
    print("\n" + "="*80)
    print("🧪 Citation Graph Test Suite")
    print("="*80)
    
    # Test 1: Direct API call to see what's happening
    print("\n[Step 1] Testing API directly...")
    test_direct_api()
    
    print("\n" + "="*80)
    print("[Step 2] Testing with improved retry logic...")
    print("="*80)
    
    # Test with improved retry logic
    arxiv_id = test_arxiv_ids[0]  # Use Transformer paper
    success = test_citation_graph(arxiv_id)
    
    if success:
        print(f"\n✅ Test PASSED - Got data for {arxiv_id}")
    else:
        print(f"\n❌ Test FAILED - No data for {arxiv_id}")
        print("\n💡 Tips to fix rate limiting:")
        print("   1. Try with fewer retries during peak hours")
        print("   2. Wait 2-3 minutes before trying again")
        print("   3. Consider getting an S2 API key: https://www.semanticscholar.org/product/api")
        print("   4. Or use a cached/offline approach for common papers")


if __name__ == "__main__":
    main()
